# Agent log

A dated entry for each time I worked with the coding agent (Claude Code on the web), with the newest entry at the bottom. Each entry records what I asked, what the agent produced, and what was checked or changed.

## 2026-11-13: Plan for the final project

- **Asked:** "Can you please complete the website based on the attached instructions?" (with the final project instructions attached as a PDF)
- **Agent produced:** No code yet. It read the instructions and `docs/data_description_sheet.md`, loaded the data, and wrote a plan: a single long page in plain HTML, CSS and JavaScript, built in steps, with a smaller data file made by a script.
- **Checked or changed:** The agent confirmed the data loads as described (35,442 rows, 18 cities, 11 campus areas) and that its Q1 answer (Davis, CA at $889,000) matches the description sheet. It also found that the first publish run had failed because GitHub Pages was not turned on yet.

## 2026-11-13: First working version (Q1 to Q10 and Explore)

- **Asked:** "Can you load the font(s) from a CDN? Using D3 sounds great. Please go ahead with the steps you've listed."
- **Asked:** "Is d3 better than observable?" and "If d3 requires more customization, I think using observable plots may be a good idea too." and then "I trust you with your ability, so you can make the decision."
- **Agent produced:** The site shell with light and dark modes, Q1 to Q6, Q7 to Q10 with their own settings, and the Explore section (filters, key numbers, map, range sliders, feature filters, shareable link, comparison, sortable table). It stayed with D3 because the chart code was already written and the map needed D3 anyway.
- **Checked or changed:** The agent ran every calculation twice, in the site's JavaScript and in pandas on the original CSV. All ten questions matched, including Q7 to Q10 at several settings, and the Explore numbers matched for several filter combinations. The check showed that Q5 has a four-way tie for fastest campus area, so the site reports all four.
- **What the agent got wrong:** Its first phone layout ran off the side of the screen. At 360 pixels wide, the header, the map labels and the results table were wider than the page. The agent caught this with a script that measures every element at five screen widths, then fixed the header, the labels and the table.

## 2026-11-13: Design round 1, plain layout

- **Asked:** "Can you avoid using all caps for subtitles or kickers? For example "ANSWER" should be "Answer"." and "Also, avoid using an increased letter spacing after you use a normal case."
- **Asked:** "This looks great. Can you avoid using card designs and just use plain background? Use spacing and alignment to separate the sections."
- **Agent produced:** Small labels in normal case with normal spacing. All boxes, borders and shadows removed, with sections separated by spacing. Map markers made smaller, with labels placed automatically.
- **Checked or changed:** I asked for these changes after seeing the first version. The agent recorded them in `AGENTS.md` so later work follows them.
- **What the agent got wrong:** On the map, the Penn State and Michigan labels overlapped. The agent replaced its hand-set label positions with a rule that tries each side of a marker and skips a label that has no free spot.

## 2026-11-13: Design round 2, white background and icons

- **Asked:** "This looks great. Thank you. Can you replace the house logo icon with a chart icon without a background? If you can use lucide icons, use chart-column-increasing with the same font color as the text."
- **Asked:** "On light mode, can you use a completely white background?"
- **Agent produced:** The Lucide chart icon as the logo and browser-tab icon, Lucide icons for the theme toggle, buttons and sort arrows, and a pure white background in light mode.
- **Checked or changed:** The agent re-ran its color check for the chart colors against the new white background.
- **What the agent got wrong:** The new logo first showed at the wrong size, because a general icon style overrode the logo's size. The agent saw it in a screenshot and fixed it.

## 2026-11-13: Insights, Data and methods, README

- **Asked:** "What serif font and weight are you using in the hero section?" then "For bold styles, can you use a lighter weight? Perhaps 600 instead of 700?" and "Remove the bottom border from the top bar."
- **Agent produced:** The Insights section (P1 on blank dates, with a chart and table computed from the data, and a draft of P2), the Data and methods section, this log and the README. Bold text now uses weight 600 and the top bar has no border.
- **Checked or changed:** The agent checked the P1 numbers against pandas. The P2 text is a draft based on what happened in this session, for me to review and rewrite in my own words.

## 2026-11-13: Design round 3, phone layout and chart details

- **Asked:** "Can you slightly decrease the border radius of rounded corner buttons?"
- **Agent produced:** Buttons and form controls with a 6px corner radius. On its own review of phone and dark-mode screenshots, the agent also changed how bar charts fit a narrow screen, kept chart labels readable where they cross gridlines, made the written answer stay in view beside a tall chart on wide screens, highlighted the current section in the top bar, and added links to the footer.
- **Checked or changed:** The agent re-ran its number checks against pandas, its screen-width check at six widths, and a test that hovers over the marks of every chart.
- **What the agent got wrong:** Tooltips did not appear when the pointer was directly on a bar or dot, only on the empty space beside it, because the marks were drawn on top of the invisible hover areas. The agent found this when its hover test timed out, and fixed it so marks and labels let the pointer through.
