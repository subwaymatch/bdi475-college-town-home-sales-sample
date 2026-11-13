"""Make data/site_sales.csv, the smaller file the website loads.

It holds every row of data/college_town_home_sales.csv, in the same order, but only
the columns the site uses. No value is changed, rounded or recalculated: each cell is
copied exactly as it appears in the original file.

Run from the repository root:

    python scripts/make_site_data.py

It needs only Python 3 (no extra packages).
"""

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "college_town_home_sales.csv"
OUTPUT = ROOT / "data" / "site_sales.csv"

COLUMNS = [
    "city",
    "state",
    "university",
    "latitude",
    "longitude",
    "miles_to_campus",
    "list_date",
    "contract_date",
    "sale_date",
    "sale_price",
    "beds",
    "living_area_sqft",
    "year_built",
    "has_basement",
    "has_garage",
    "has_fireplace",
    "tax_annual_amount",
]


def main() -> None:
    rows_written = 0
    with SOURCE.open(newline="", encoding="utf-8") as src, OUTPUT.open(
        "w", newline="", encoding="utf-8"
    ) as out:
        reader = csv.DictReader(src)
        missing = [c for c in COLUMNS if c not in reader.fieldnames]
        if missing:
            raise SystemExit(f"Columns missing from the source file: {missing}")
        writer = csv.writer(out, lineterminator="\n")
        writer.writerow(COLUMNS)
        for row in reader:
            writer.writerow([row[c] for c in COLUMNS])
            rows_written += 1
    print(f"Wrote {rows_written:,} rows and {len(COLUMNS)} columns to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
