# 🧾 Backups

This folder is filled automatically by **.github/workflows/backup.yml** every 2 hours,
but only when someone changed the trip since the last backup.

| Folder | What's in it |
|---|---|
| `latest/` | Always the newest copy: `Goa-Trip.xlsx` (Excel), one `.csv` per table, `trip.json`, `INFO.md` |
| `history/YYYY-MM-DD/HHMM_revN/` | A frozen copy of every version, e.g. `history/2026-09-27/1400_rev57/` |

**Tables:** Expenses (every bill: where/what, place, who paid, split, who added it) ·
Spend by day · Plan (the day × time-slot table) · Places · Budget · Balances (who owes whom).

## Going back to an older version
1. **Easiest:** website → 🕘 **History** → *Preview* → *Restore this version*.
2. **From here:** open the version folder → download `trip.json` → website → **⬆ Import**.

Restoring is itself saved as a new version, so you can always undo it.

A second, independent copy of every snapshot (CSV + Excel) is saved in Google Drive →
**Goa Trip Planner / Snapshots (every 2h)**.
