---
name: On call scheduler
description: Create a schedule for on call shifts. Use this skill any time an on call schedule request is made. 
---

# Scheduler

A skill for helping to schedule on call days/nights for surgeons.

# Current Process

3 months in advance, an on call schedule is made. The on call scheduling must follow certain rules and also work around existing schedules, time off, and preferences. 

# Holidays
If a holiday falls on a weekend, it is observed on the Friday before. 

- January 1 (New years)
- Martin Luther King day
- President's day
- Memorial day
- July 4th
- Labor day
- Thanksgiving day
- Christmas day

# On call shift types

- OCD (On call day): 8am to 8pm (same day)
- OCN (On call night): 8pm to 8am (the following day)
- EGS (Emergency general surgeon): 8am to 12pm (Monday to Friday, consecutively) once a month
- 24 hour call: Consecutive 1 OCD and 1 OCN shift (for a total of 24 hours)

# Surgeon types

- EGS: EGS surgeons will do one EGS shift a month. In addition, they will work a total of 3 OCD and 2 OCN. 
- Non-EGS: Non-egs surgeons do not work EGS shifts. They work a total of 4 OCD and 3 OCN. 

Note: If a surgeon works a 24 hour call, that counts towards 1 OCD and 1 OCN. 

# Rules
- For any given calendar day, including weekends. There must be 24 hour coverage, it can be one surgeon on 24 hour call, or 2 surgeons (1 on OCD, 1 on OCN). 
- There can never be a day where there is a gap in coverage. There must always be a person(s) assigned to cover the full day. 
- If a surgeon has an OCD blackout on a given date, they cannot be assigned OCD on that date.
- If a surgeon has an OCN blackout on a given date, they cannot be assigned OCN on that date.
- If a surgeon has both OCD and OCN blackouts on a given date, they cannot be assigned any on call shift on that date. 
- If a surgeon is assigned an EGS call, they cannot be assigned OCD or OCN at the same time.
- If a surgeon is assigned OCN or OCD, there should be a minimum of at least 3 calendar days in between another on call shift. For example, if a surgeon is OCN from Monday 8am until Tuesday 8am, they should not be assigned any on call shift until at least Friday of the same week. 
-A surgeon shall only work a max of 2 weekend on call shifts a month (OCD or OCN). They should never be scheduled to work on call for 2 consecutive weekends a month. A weekend in this context, and this context only, is Friday to Sunday. 
- If a surgeon is assigned to a robot block, they cannot be assigned to any on call shifts the day before the robot block. However, if they were assisting on a robot, they can be assigned OCD the day before. 
- If a surgeon has only OCN scheduled, they must be assigned Precall AM (the day of), and postcall PM (the next day). 
- If a surgeon is assigned a 24 hour call (OCD and OCN), they must have postcall AM and postcall PM scheduled the day their OCN shift ends.
- If a surgeon is assigned a 24 hour call, there is already 24 hour coverage. No other surgeon needs to be assigned an on call shift. 

# Spacing and fairness

- Spread assignments across the month as evenly as possible.
- Avoid back-to-back call assignments for the same surgeon whenever possible.
- Strongly prefer at least 3 calendar days between any two call assignments (whether it's OCN or OCD) for the same surgeon.
- Distribute calls across different weeks as evenly as possible.
- Prioritize equity: surgeons with fewer assigned calls so far should be chosen before surgeons with more assigned calls, as long as higher-priority constraints are respected.
- Spacing is a soft goal.
- Never violate blackout, EGS, post-call, pool, or max-call limits just to improve spacing.
