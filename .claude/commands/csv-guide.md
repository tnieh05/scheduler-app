---
name: CSV schedule guide
description: Explains the expected CSV format, column headers, and abbreviations for uploading an on call schedule. Use this any time a user uploads a .csv file related to scheduling.
---

# CSV Schedule Guide

Use this guide to interpret any `.csv` file uploaded for on call scheduling.

# Expected Columns

| Column | Description |
|---|---|
| `Surgeon` | Last name 
| `Type` | Surgeon type: `EGS` or `Non-EGS` |
| `Date` | Calendar date in `MM/DD/YYYY` format |
| `Shift` | Shift assignment (see abbreviations below) |
| `Blackout_OCD` | Dates the surgeon cannot take OCD (comma-separated, `MM/DD/YYYY`) |
| `Blackout_OCN` | Dates the surgeon cannot take OCN (comma-separated, `MM/DD/YYYY`) |
| `Robot_Block` | Dates the surgeon has a robot block (comma-separated, `MM/DD/YYYY`) |
| `Robot_Assist` | Dates the surgeon is assisting on robot — not a full block (comma-separated, `MM/DD/YYYY`) |
| `Notes` | Free-text notes or special requests |

# Shift Abbreviations

| Abbreviation | Full Name | Hours |
|---|---|---|
| `OCD` | On Call Day | 8am – 8pm (same day) |
| `OCN` | On Call Night | 8pm – 8am (following day) |
| `EGS` | Emergency General Surgeon | 8am – 12pm (Mon–Fri, consecutive, once/month) |
| `24H` | 24 Hour Call | 1 OCD + 1 OCN (consecutive, full 24 hours) |
| `PRE-AM` | Precall AM | Morning before an OCN shift |
| `POST-AM` | Postcall AM | Morning after an OCN or 24H shift ends |
| `POST-PM` | Postcall PM | Afternoon after an OCN or 24H shift ends |

# Surgeon Type Abbreviations

| Abbreviation | Meaning |
|---|---|
| `EGS` | EGS surgeon — does 1 EGS shift/month + 3 OCD + 2 OCN |
| `Non-EGS` | Non-EGS surgeon — no EGS shifts + 4 OCD + 3 OCN |

# Notes on Parsing

- A `24H` shift entry counts as both 1 OCD and 1 OCN toward the surgeon's monthly totals.
- If a surgeon has `Robot_Block` on a date, they cannot be assigned any on call shift the day before.
- If a surgeon has `Robot_Assist` (not a full block), they can still take OCD the day before.
- Blackout columns may be empty if there are no restrictions for that surgeon.
- Dates are assumed to be within the 3-month scheduling window unless otherwise noted.
