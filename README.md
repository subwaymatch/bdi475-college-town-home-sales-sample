# College-Town Home Sales

An analysis of 35,442 completed home sales around 11 university campuses, in 18 cities across the United States. It is the final project for BDI 475.

## Live site

https://subwaymatch.github.io/bdi475-college-town-home-sales-sample/

## What this site is for

The site answers ten business questions about college-town housing, for a reader who wants to compare markets: which cities are most expensive, where homes sell fastest, where property tax is heaviest, and how far from campus a given budget buys.

| Section | What it holds |
|---|---|
| **Questions** | Q1 to Q10, each with a written answer, a chart and a table of the same numbers. Q1 to Q6 use the full dataset. Q7 to Q10 have their own settings (bedrooms, price range, city and year, campus area and budget) and recalculate when a setting changes. |
| **Explore** | Filters for campus area, city, year, bedrooms, price, distance from campus, year built, garage, basement and fireplace. Key numbers, a map of campus areas, two charts, a side-by-side comparison and a sortable table all follow the filters. The filter settings are saved in the page address, so a copied link opens the same view. |
| **Insights** | P1: what happens to days on market if a blank date is treated as zero. P2: what it was like to build the analysis with a coding agent. |
| **Data and methods** | The rules behind every number. |

The site has a light and a dark mode, and works on desktop, tablet and phone screens.

## Data notes

Every number on the site is calculated in the browser from the data when the page loads. The rules:

- **Price rule.** Unless a question says otherwise, only sales from $10,000 to $5,000,000, inclusive, are used. That leaves out 40 sales below $10,000 and 31 above $5,000,000. Q2 uses all rows, Q3 compares both, and Q9 counts all rows with a sale date.
- **Days on market** is `contract_date` minus `list_date`, in days, using only rows that have both dates. A blank date is treated as unknown, never as zero.
- **City** means city and state together. **Campus area** means the `university` column. **Year** and **month** come from `sale_date`.
- **Median** is used unless a question asks for the mean. Ties are all reported, and medians are shown with their number of sales.
- **Missing values** stay missing. The garage, basement and fireplace filters offer Unknown as its own choice. Price per square foot uses only rows with a living area above zero.
- **Property tax (Q6)** uses rows with a valid price and a tax amount above $0 and below 10% of the sale price.
- **Rows are never merged.** `listing_id` is the key, and sales that share a street address are kept. The `home_type` column is not used.
- **The map** places each campus area at the median latitude and longitude of its sales, because the dataset has no campus coordinates.

The "Five things that will bite you" in `docs/data_description_sheet.md` are handled as follows: blank dates (the days-on-market rule above), repeated addresses (rows are never merged), impossible prices (the price rule), unreliable `home_type` (not used), and impossible values (the living-area and tax rules above).

### The smaller data file

The site loads `data/site_sales.csv` instead of the full 9 MB file. It holds every row of `data/college_town_home_sales.csv`, in the same order, with only the 17 columns the site uses. No value is changed. To make it again, run this from the repository root (Python 3, no extra packages):

```
python scripts/make_site_data.py
```

### How the numbers were checked

The calculations are in `js/analysis.js`. The answers to all ten questions were recalculated separately in pandas from the original CSV file and matched, including Q7 to Q10 at several different settings.

## Tools used

- **Coding agent:** Claude Code on the web. The agent planned the site, wrote the code and checked the numbers. I directed the work and the design.
- **Charts and map:** [D3](https://d3js.org) 7, with US state outlines from [us-atlas](https://github.com/topojson/us-atlas), both stored in `vendor/`.
- **Icons:** [Lucide](https://lucide.dev).
- **Typefaces:** Source Serif 4 and Inter, from Google Fonts.
- **Hosting:** GitHub Pages. The site is plain HTML, CSS and JavaScript with no build step.

| Path | What it is |
|---|---|
| `index.html` | The page |
| `css/styles.css` | All styles, including the light and dark themes |
| `js/analysis.js` | Every calculation on the site |
| `js/charts.js` | The chart and map drawing code |
| `js/questions.js`, `js/questions-live.js` | Q1 to Q6, and Q7 to Q10 |
| `js/explore.js` | The Explore section |
| `js/insights.js` | The Insights chart and numbers |
| `data/site_sales.csv` | The smaller data file the site loads |
| `scripts/make_site_data.py` | Makes `data/site_sales.csv` |
| `docs/data_description_sheet.md` | What every column means |
| `AGENT_LOG.md` | A log of the work with the coding agent |

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
