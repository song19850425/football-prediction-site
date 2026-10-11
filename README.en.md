# Football Prediction System · Online Overview

**Language:** [中文](README.md) | English | [日本語](README.ja.md) | [한국어](README.ko.md)

> One link to browse every page across the entire football prediction system.

**Online access:** https://song19850425.github.io/football-prediction-site/

## Introduction

This repository is the **static site hub** for the football odds prediction project. It brings the live dashboard, the desktop / mobile product prototypes, the V3 prediction handbook, past prediction and validation reports, and the model backtesting and upgrade plans together into a single portal, and it also provides an "All Pages Viewer" so you can browse every page within one interface.

## Page Entries

| Page | Description | Link |
| --- | --- | --- |
| Overview Portal | A card-based entry to the whole site: 38 pages across 7 sections | https://song19850425.github.io/football-prediction-site/ |
| All Pages Viewer | Left-hand directory + embedded iframe preview | https://song19850425.github.io/football-prediction-site/viewer.html |
| Historical Data | Top five leagues, 10 seasons · 17,937 matches, with filtering by league / season / result / team and season trend charts | https://song19850425.github.io/football-prediction-site/history.html |
| Next Week Predictions | Top five leagues fixtures for the next 7 days + Poisson model trend predictions | https://song19850425.github.io/football-prediction-site/weekly.html |
| Live Dashboard | AI Football Prediction Center · Live Dashboard | https://song19850425.github.io/football-prediction-site/dashboards/prediction-dashboard-deploy/index.html |

## Feature Sections

- Core applications and dashboards
- Product prototypes · Desktop / Mobile
- V3 prediction handbook
- Prediction reports / validation reports
- Data / models / backtesting

## Tech Stack

- Pure static `HTML + CSS + vanilla JavaScript`, with no build step required
- Charts: season trend charts are hand-written SVG; dashboards use ECharts
- Visit counter: counterapi.dev (with a localStorage fallback)
- Deployment: GitHub Pages (`main` branch root, including `.nojekyll`)

## Data Sources

Historical match data comes from the public dataset [football-data.co.uk](https://www.football-data.co.uk/) and is used solely for machine learning and data research display.

## Disclaimer

This project is intended only for machine learning and data research display and **does not constitute any betting advice**. Historical backtesting performance does not represent future results.

## License

[MIT](LICENSE)