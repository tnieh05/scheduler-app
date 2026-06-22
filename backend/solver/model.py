from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Dict, List, Set

from ortools.sat.python import cp_model

from .types import (
    GenerateRequest,
    GenerateResponse,
    Shift,
    ShiftKind,
    SurgeonType,
)

CALL_KINDS = ['OCD', 'OCN', '24H']

# Monthly max per kind (ocd and ocn include 24H contributions)
MONTHLY_QUOTAS = {
    SurgeonType.EGS:     {'ocd': 3, 'ocn': 2, 'h24': 2},
    SurgeonType.NON_EGS: {'ocd': 4, 'ocn': 3, 'h24': 2},
    SurgeonType.POOL:    {'ocd': 0, 'ocn': 0, 'h24': 6},
}


def _iso(d: date) -> str:
    return d.isoformat()


def _date_range(start: str, end: str) -> List[str]:
    d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    result: List[str] = []
    while d <= end_d:
        result.append(_iso(d))
        d += timedelta(days=1)
    return result


def _add_days(d: str, n: int) -> str:
    return _iso(date.fromisoformat(d) + timedelta(days=n))


def _is_weekend(d: str) -> bool:
    """Fri=4, Sat=5, Sun=6 in Python's weekday()."""
    return date.fromisoformat(d).weekday() >= 4


def _week_monday(d: str) -> str:
    dt = date.fromisoformat(d)
    return _iso(dt - timedelta(days=dt.weekday()))


def _month_key(d: str) -> str:
    return d[:7]


def solve_schedule(request: GenerateRequest) -> GenerateResponse:
    all_dates = _date_range(request.range_.start, request.range_.end)
    date_set: Set[str] = set(all_dates)

    pool_surgeons = [s for s in request.surgeons if s.type == SurgeonType.POOL]
    active_surgeons = [s for s in request.surgeons if s.type != SurgeonType.POOL]

    # Pool surgeons cover the OCN slot only on their available dates.
    # OCD coverage for those dates still comes from regular surgeons.
    pool_ocn_covered: Set[str] = set()
    pool_shifts: List[Shift] = []
    for ps in pool_surgeons:
        for d in (ps.available_dates or []):
            if d in date_set:
                pool_ocn_covered.add(d)
                pool_shifts.append(Shift(
                    id=str(uuid.uuid4()),
                    surgeon_id=ps.id,
                    date=d,
                    kind=ShiftKind.OCN,
                    ancillaries=['PRECALL_AM', 'POSTCALL_PM'],
                ))

    # Pass-through EGS shifts unchanged
    egs_shifts = [
        s for s in (request.existing_shifts or [])
        if s.kind == ShiftKind.EGS
    ]

    # Dates each surgeon is on EGS duty (blocked for call)
    egs_blocked: Dict[str, Set[str]] = {s.id: set() for s in active_surgeons}
    for shift in egs_shifts:
        sid = shift.surgeon_id
        if sid not in egs_blocked:
            continue
        for d in _date_range(shift.date, shift.end_date or shift.date):
            if d in date_set:
                egs_blocked[sid].add(d)

    # ── Pinned call shifts ──────────────────────────────────────────────────
    # Existing OCD/OCN/24H shifts (from a prior Generate or manual drag-and-drop)
    # are pinned as hard constraints so Generate preserves manual edits.
    # Shifts that are now blocked by current constraints are silently dropped
    # so the solver can reassign those slots cleanly.
    active_ids = {s.id for s in active_surgeons}

    # Build current block lookups from the latest surgeon state
    _ocd_blocked: Set[tuple] = set()
    _ocn_blocked: Set[tuple] = set()
    for s in active_surgeons:
        for bo in s.blackouts:
            if bo.type in ('OCD', 'BOTH'):
                _ocd_blocked.add((s.id, bo.date))
            if bo.type in ('OCN', 'BOTH'):
                _ocn_blocked.add((s.id, bo.date))
    _robot_blocked: Set[tuple] = set()
    for s in active_surgeons:
        for rb in s.robot_blocks:
            _robot_blocked.add((s.id, rb.date))
            _robot_blocked.add((s.id, _add_days(rb.date, -1)))
    _egs_blocked: Set[tuple] = {
        (sid, d) for sid, dates in egs_blocked.items() for d in dates
    }

    def _currently_blocked(shift: Shift) -> bool:
        sid, d, k = shift.surgeon_id, shift.date, shift.kind.value
        if k in ('OCD', '24H') and (sid, d) in _ocd_blocked:
            return True
        if k in ('OCN', '24H') and (sid, d) in _ocn_blocked:
            return True
        if (sid, d) in _robot_blocked:
            return True
        if (sid, d) in _egs_blocked:
            return True
        return False

    pinned_calls = [
        s for s in (request.existing_shifts or [])
        if s.kind in (ShiftKind.OCD, ShiftKind.OCN, ShiftKind.H24)
        and s.pinned is True
        and s.surgeon_id in active_ids
        and s.date in date_set
        # On pool OCN dates, only OCD pins are valid (OCN/24H vars don't exist)
        and (s.date not in pool_ocn_covered or s.kind == ShiftKind.OCD)
        and not _currently_blocked(s)
    ]

    # When a day has a pinned OCD or OCN alongside a pinned 24H, coverage is
    # over-specified (OCD + 24H = 2 OCD-coverage slots, violating == 1).
    # Drop the 24H pin so the coverage constraint forces the solver to replace
    # it with the appropriate split (OCD + OCN from separate surgeons).
    # The former 24H surgeon becomes free to take just OCD or OCN that day.
    _split_days = (
        {s.date for s in pinned_calls if s.kind == ShiftKind.OCD}
        | {s.date for s in pinned_calls if s.kind == ShiftKind.OCN}
    )
    pinned_calls = [
        s for s in pinned_calls
        if not (s.kind == ShiftKind.H24 and s.date in _split_days)
    ]

    # ── Build CP-SAT model ──────────────────────────────────────────────────
    model = cp_model.CpModel()

    # x[(surgeon_id, date, kind)] = BoolVar (1 = assigned)
    # On pool OCN dates, only OCD is still needed from regular surgeons —
    # OCN is covered by the pool surgeon, so OCN/24H vars are not created.
    x: Dict[tuple, cp_model.IntVar] = {}
    for s in active_surgeons:
        for d in all_dates:
            kinds = ['OCD'] if d in pool_ocn_covered else CALL_KINDS
            for k in kinds:
                x[(s.id, d, k)] = model.new_bool_var(f'{s.id[:8]}_{d}_{k}')

    # Lock pinned shifts — solver must assign exactly these
    for shift in pinned_calls:
        key = (shift.surgeon_id, shift.date, shift.kind.value)
        if key in x:
            model.add(x[key] == 1)

    # ── Coverage: every day must have exactly 1 OCD-cov + 1 OCN-cov
    # Pool OCN dates: OCN is already satisfied by pool — only enforce OCD == 1.
    # Other dates: OCD shift OR 24H covers OCD slot; OCN shift OR 24H covers OCN slot.
    for d in all_dates:
        ocd_cov = (
            [x[(s.id, d, 'OCD')] for s in active_surgeons if (s.id, d, 'OCD') in x]
            + [x[(s.id, d, '24H')] for s in active_surgeons if (s.id, d, '24H') in x]
        )
        if ocd_cov:
            model.add(sum(ocd_cov) == 1)
        if d not in pool_ocn_covered:
            ocn_cov = (
                [x[(s.id, d, 'OCN')] for s in active_surgeons if (s.id, d, 'OCN') in x]
                + [x[(s.id, d, '24H')] for s in active_surgeons if (s.id, d, '24H') in x]
            )
            if ocn_cov:
                model.add(sum(ocn_cov) == 1)

    # ── At most one call shift per surgeon per day ──────────────────────────
    for s in active_surgeons:
        for d in all_dates:
            day_vars = [x[(s.id, d, k)] for k in CALL_KINDS if (s.id, d, k) in x]
            if day_vars:
                model.add(sum(day_vars) <= 1)

    # ── Blackout constraints ────────────────────────────────────────────────
    for s in active_surgeons:
        for bo in s.blackouts:
            d = bo.date
            if d not in date_set:
                continue
            blocks_ocd = bo.type in ('OCD', 'BOTH')
            blocks_ocn = bo.type in ('OCN', 'BOTH')
            if blocks_ocd:
                for k in ('OCD', '24H'):
                    if (s.id, d, k) in x:
                        model.add(x[(s.id, d, k)] == 0)
            if blocks_ocn:
                for k in ('OCN', '24H'):
                    if (s.id, d, k) in x:
                        model.add(x[(s.id, d, k)] == 0)

    # ── EGS duty blocks call assignments ───────────────────────────────────
    for s in active_surgeons:
        for d in egs_blocked.get(s.id, set()):
            for k in CALL_KINDS:
                if (s.id, d, k) in x:
                    model.add(x[(s.id, d, k)] == 0)

    # ── Shift-type exclusivity (hard) ───────────────────────────────────────
    # '24H_ONLY': surgeon may only be assigned 24H — never OCD or OCN.
    # '12H_ONLY': surgeon may only be assigned OCD/OCN — never 24H.
    for s in active_surgeons:
        pref = s.preferences.shift_preference
        if pref not in ('24H_ONLY', '12H_ONLY'):
            continue
        blocked_kinds = ('OCD', 'OCN') if pref == '24H_ONLY' else ('24H',)
        for d in all_dates:
            for k in blocked_kinds:
                if (s.id, d, k) in x:
                    model.add(x[(s.id, d, k)] == 0)

    # ── Rest before EGS start ───────────────────────────────────────────────
    # 24H on D ends on D+1. EGS starting on D+1 violates the required 1-free-day
    # gap (validator rule: 24H → EGS needs gap >= 1). Block 24H on E-1 for each
    # EGS block starting on date E.
    for shift in egs_shifts:
        sid = shift.surgeon_id
        egs_start = shift.date
        d_prev = _add_days(egs_start, -1)
        if d_prev in date_set:
            if (sid, d_prev, '24H') in x:
                model.add(x[(sid, d_prev, '24H')] == 0)

    # ── Robot blocks ────────────────────────────────────────────────────────
    # Robot day D: no call (surgeon is in OR all day)
    # Day before D-1: no OCN/24H; no OCD unless surgeon is only assisting
    for s in active_surgeons:
        for rb in s.robot_blocks:
            d = rb.date
            d_prev = _add_days(d, -1)

            if d in date_set:
                for k in CALL_KINDS:
                    if (s.id, d, k) in x:
                        model.add(x[(s.id, d, k)] == 0)

            if d_prev in date_set:
                for k in ('OCN', '24H'):
                    if (s.id, d_prev, k) in x:
                        model.add(x[(s.id, d_prev, k)] == 0)
                if not rb.assisting_only:
                    if (s.id, d_prev, 'OCD') in x:
                        model.add(x[(s.id, d_prev, 'OCD')] == 0)

    # ── Rest windows ────────────────────────────────────────────────────────
    # After OCD on day D: no call on D+1, D+2
    # After OCN or 24H on day D: no call on D+1, D+2, D+3
    for s in active_surgeons:
        for i, d1 in enumerate(all_dates):
            if (s.id, d1, 'OCD') in x:
                for delta in (1, 2):
                    j = i + delta
                    if j >= len(all_dates):
                        break
                    d2 = all_dates[j]
                    d2_calls = [x[(s.id, d2, k)] for k in CALL_KINDS if (s.id, d2, k) in x]
                    if d2_calls:
                        model.add(x[(s.id, d1, 'OCD')] + sum(d2_calls) <= 1)

            d1_nights = [x[(s.id, d1, k)] for k in ('OCN', '24H') if (s.id, d1, k) in x]
            if d1_nights:
                for delta in (1, 2, 3):
                    j = i + delta
                    if j >= len(all_dates):
                        break
                    d2 = all_dates[j]
                    d2_calls = [x[(s.id, d2, k)] for k in CALL_KINDS if (s.id, d2, k) in x]
                    if d2_calls:
                        model.add(sum(d1_nights) + sum(d2_calls) <= 1)

    # ── Monthly quotas ──────────────────────────────────────────────────────
    # The OCD/OCN counts in shiftQuotas are soft targets — the TypeScript
    # generator explicitly exceeds them in its coverage pass when necessary.
    # Only the 24H per-month limit is a true hard cap.
    month_dates: Dict[str, List[str]] = {}
    for d in all_dates:
        month_dates.setdefault(_month_key(d), []).append(d)

    for s in active_surgeons:
        q = MONTHLY_QUOTAS[s.type]
        for ym, mdates in month_dates.items():
            h24_terms = [
                x[(s.id, d, '24H')] for d in mdates
                if (s.id, d, '24H') in x
            ]
            if h24_terms:
                h24_cap = s.preferences.max_24h if s.preferences.max_24h is not None else q['h24']
                model.add(sum(h24_terms) <= h24_cap)
            ocd_terms = [
                x[(s.id, d, 'OCD')] for d in mdates
                if (s.id, d, 'OCD') in x
            ]
            if ocd_terms and s.preferences.max_ocd is not None:
                model.add(sum(ocd_terms) <= s.preferences.max_ocd)
            ocn_terms = [
                x[(s.id, d, 'OCN')] for d in mdates
                if (s.id, d, 'OCN') in x
            ]
            if ocn_terms and s.preferences.max_ocn is not None:
                model.add(sum(ocn_terms) <= s.preferences.max_ocn)

    # ── Weekend call limits ─────────────────────────────────────────────────
    # Max 2 weekend (Fri–Sun) calls per surgeon per month
    for s in active_surgeons:
        for ym, mdates in month_dates.items():
            wknd = [
                x[(s.id, d, k)] for d in mdates for k in CALL_KINDS
                if (s.id, d, k) in x and _is_weekend(d)
            ]
            if wknd:
                model.add(sum(wknd) <= 2)

    # No consecutive weekends: if surgeon works a weekend call in week N,
    # they cannot work a weekend call in week N+1.
    week_dates: Dict[str, List[str]] = {}
    for d in all_dates:
        week_dates.setdefault(_week_monday(d), []).append(d)
    all_weeks = sorted(week_dates.keys())

    for s in active_surgeons:
        for i in range(len(all_weeks) - 1):
            w1, w2 = all_weeks[i], all_weeks[i + 1]
            ww1 = [
                x[(s.id, d, k)] for d in week_dates[w1] for k in CALL_KINDS
                if (s.id, d, k) in x and _is_weekend(d)
            ]
            ww2 = [
                x[(s.id, d, k)] for d in week_dates[w2] for k in CALL_KINDS
                if (s.id, d, k) in x and _is_weekend(d)
            ]
            if not ww1 or not ww2:
                continue
            hw1 = model.new_bool_var(f'hw1_{s.id[:8]}_{w1}')
            hw2 = model.new_bool_var(f'hw2_{s.id[:8]}_{w2}')
            # hw1 ↔ (sum(ww1) >= 1)
            model.add(sum(ww1) >= 1).only_enforce_if(hw1)
            model.add(sum(ww1) == 0).only_enforce_if(hw1.Not())
            # hw2 ↔ (sum(ww2) >= 1)
            model.add(sum(ww2) >= 1).only_enforce_if(hw2)
            model.add(sum(ww2) == 0).only_enforce_if(hw2.Not())
            model.add(hw1 + hw2 <= 1)

    # ── Max 2 calls per Mon–Sun week ────────────────────────────────────────
    for s in active_surgeons:
        for mon, wdates in week_dates.items():
            wk_calls = [
                x[(s.id, d, k)] for d in wdates for k in CALL_KINDS
                if (s.id, d, k) in x
            ]
            if wk_calls:
                model.add(sum(wk_calls) <= 2)

    # ── Objective: minimize sum of per-month call-count spreads ────────────
    # Optimizing per-month (not total-range) ensures equity within each
    # calendar month rather than trading June slack for August surplus.
    MAX_POSSIBLE = 15
    spread_terms = []

    for ym, mdates in month_dates.items():
        m_tc_vars = []
        for s in active_surgeons:
            m_tc = model.new_int_var(0, MAX_POSSIBLE, f'tc_{s.id[:8]}_{ym}')
            terms = [
                x[(s.id, d, k)] for d in mdates for k in CALL_KINDS
                if (s.id, d, k) in x
            ]
            # 24H counts as 2 (one OCD-equivalent + one OCN-equivalent)
            extra_h24 = [x[(s.id, d, '24H')] for d in mdates if (s.id, d, '24H') in x]
            all_terms = terms + extra_h24
            model.add(m_tc == (sum(all_terms) if all_terms else 0))
            m_tc_vars.append(m_tc)

        if m_tc_vars:
            m_max = model.new_int_var(0, MAX_POSSIBLE, f'max_tc_{ym}')
            m_min = model.new_int_var(0, MAX_POSSIBLE, f'min_tc_{ym}')
            model.add_max_equality(m_max, m_tc_vars)
            model.add_min_equality(m_min, m_tc_vars)
            spread_terms.append(m_max - m_min)

    # ── Shift-type preferences (soft, secondary to equity) ──────────────────
    # Each preferred 24H (or avoided 24H) nudges the solver without ever
    # overriding equity. Scale spread by 10 so a 1-unit equity improvement
    # always beats satisfying ~10 individual preference nudges.
    pref_terms = []
    for s in active_surgeons:
        pref = s.preferences.shift_preference
        if pref == 'none':
            continue
        for d in all_dates:
            if d in pool_ocn_covered:
                continue
            h24_var = x.get((s.id, d, '24H'))
            if h24_var is None:
                continue
            if pref == '24H':
                pref_terms.append(-h24_var)   # reward 24H (lower cost = preferred)
            else:  # '12H'
                pref_terms.append(h24_var)    # penalize 24H (higher cost = avoided)

    # ── OCD/OCN balance for 12H-preferring surgeons (soft) ──────────────────
    # Minimise |ocd_total - ocn_total| per surgeon so each gets a roughly even
    # split of day and night calls. Applies to '12H' and '12H_ONLY' surgeons.
    balance_terms = []
    n_dates = len(all_dates)
    for s in active_surgeons:
        if s.preferences.shift_preference not in ('12H', '12H_ONLY'):
            continue
        ocd_vars = [x[(s.id, d, 'OCD')] for d in all_dates if (s.id, d, 'OCD') in x]
        ocn_vars = [x[(s.id, d, 'OCN')] for d in all_dates if (s.id, d, 'OCN') in x]
        if not ocd_vars or not ocn_vars:
            continue
        ocd_tot = model.new_int_var(0, n_dates, f'ocd_tot_{s.id[:8]}')
        ocn_tot = model.new_int_var(0, n_dates, f'ocn_tot_{s.id[:8]}')
        model.add(ocd_tot == sum(ocd_vars))
        model.add(ocn_tot == sum(ocn_vars))
        diff = model.new_int_var(-n_dates, n_dates, f'ocd_ocn_diff_{s.id[:8]}')
        model.add(diff == ocd_tot - ocn_tot)
        abs_diff = model.new_int_var(0, n_dates, f'ocd_ocn_abs_{s.id[:8]}')
        model.add_abs_equality(abs_diff, diff)
        balance_terms.append(abs_diff)

    # ── Cross-range total equity ─────────────────────────────────────────────
    # Minimise spread of each surgeon's TOTAL calls across the full period.
    # A surgeon who got 5 in June naturally gets targeted for 4 in July because
    # their running total is already higher than peers on 4.
    MAX_RANGE = 45  # generous upper bound: ~15 calls/month × 3 months
    range_tc_vars = []
    for s in active_surgeons:
        r_tc = model.new_int_var(0, MAX_RANGE, f'r_tc_{s.id[:8]}')
        terms = [x[(s.id, d, k)] for d in all_dates for k in CALL_KINDS if (s.id, d, k) in x]
        extra_h24 = [x[(s.id, d, '24H')] for d in all_dates if (s.id, d, '24H') in x]
        all_t = terms + extra_h24  # 24H counts as 2, consistent with per-month objective
        model.add(r_tc == (sum(all_t) if all_t else 0))
        range_tc_vars.append(r_tc)

    if range_tc_vars:
        r_max = model.new_int_var(0, MAX_RANGE, 'r_max_tc')
        r_min = model.new_int_var(0, MAX_RANGE, 'r_min_tc')
        model.add_max_equality(r_max, range_tc_vars)
        model.add_min_equality(r_min, range_tc_vars)
        range_spread = r_max - r_min
    else:
        range_spread = 0

    # Priority: per-month equity (×100) > cross-range total (×50) >
    #           OCD/OCN balance (×10) > type preference (×1) > utilization (×3)
    # Utilization: reward giving more calls when it doesn't affect spread.
    # Without this term, the solver is indifferent between a surgeon having
    # 2 vs 6 calls when another surgeon is stuck at the minimum — so low-
    # availability or specialty-preference surgeons (e.g. 24H_ONLY with
    # max24h=3) get left at 2 even when they could reach 6.
    equity = 100 * sum(spread_terms) if spread_terms else 0
    cross_equity = 50 * range_spread
    balance = 10 * sum(balance_terms) if balance_terms else 0
    pref = sum(pref_terms) if pref_terms else 0
    utilization = -3 * sum(range_tc_vars) if range_tc_vars else 0
    if spread_terms or range_tc_vars or balance_terms or pref_terms:
        model.minimize(equity + cross_equity + balance + pref + utilization)

    # ── Solve ───────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 4

    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise ValueError(
            f'No feasible schedule found (solver status: {solver.status_name(status)}). '
            'Check that each day has enough available surgeons and that constraints can be satisfied.'
        )

    # ── Extract solution ────────────────────────────────────────────────────
    result_shifts: List[Shift] = list(pool_shifts) + list(egs_shifts)

    for s in active_surgeons:
        for d in all_dates:
            for k in CALL_KINDS:
                if (s.id, d, k) not in x:
                    continue
                if solver.value(x[(s.id, d, k)]) != 1:
                    continue
                kind = ShiftKind(k)
                ancillaries = None
                if kind == ShiftKind.OCN:
                    ancillaries = ['PRECALL_AM', 'POSTCALL_PM']
                elif kind == ShiftKind.H24:
                    ancillaries = ['POSTCALL_AM', 'POSTCALL_PM']
                result_shifts.append(Shift(
                    id=str(uuid.uuid4()),
                    surgeon_id=s.id,
                    date=d,
                    kind=kind,
                    ancillaries=ancillaries,
                ))

    return GenerateResponse(shifts=result_shifts)
