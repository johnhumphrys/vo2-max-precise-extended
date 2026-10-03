# Garmin VO2 Max (precise)

Chrome and Firefox extension for Garmin Connect. Garmin's API returns VO2 max
to one decimal (`vo2MaxPreciseValue`) but the site shows it rounded.

- The home and report pages show the precise value (hover it for Garmin's rounded one).
- On the report pages, Garmin's Export button is replaced by a precise CSV of the
  range shown (read from the page's date label, last 12 months on "Most Recent").
- Extra buttons next to it: Export JSON, All time CSV, All time JSON.
- On 4 Weeks / 6 Months / 1 Year the chart is replaced by one with a point per day and the
  precise value (hover for the date and value). To its right it lists Garmin's VO₂ max
  ranges (Superior to Poor) for your age and sex, with your current category highlighted.
  The "Garmin's chart" button next to the export buttons switches back to Garmin's own chart.
- On "Most Recent" the same ranges list sits to the right of the gauge.

Works on `https://connect.garmin.com/app/*`. It reads the same `maxmet` endpoints
Garmin's own page uses, with the page's CSRF token. Nothing leaves connect.garmin.com.

## Install for development

    npm install
    npm test

Chrome: `chrome://extensions` -> Developer mode -> Load unpacked -> this folder.

Firefox: `npx web-ext run --source-dir . --target=firefox-desktop`
(or `about:debugging` -> Load Temporary Add-on -> `manifest.json`).

## How it fits together

- `src/dates.js` date helpers and the report date-label parser
- `src/format.js` CSV / JSON / filenames
- `src/api.js` token, `latest` and `daily` calls, row normalisation
- `src/dom.js` everything that knows Garmin's markup
- `src/content.js` wiring (MutationObserver, display, export)

If Garmin changes its markup and the number stops updating, fix `src/dom.js` and add
a jsdom test in `test/dom.test.js` that reproduces the real structure.
