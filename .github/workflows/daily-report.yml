name: Daily Market Signal Report

# ─── WHEN IT RUNS ───────────────────────────────────────────────────────────
on:
  schedule:
    # cron is in UTC. 9:00 AM US Eastern =
    #   13:00 UTC during Daylight Saving (Mar–Nov)
    #   14:00 UTC during Standard Time (Nov–Mar)
    # We run BOTH so it fires at ~9:00 AM ET year-round. The duplicate run
    # an hour off simply regenerates the same-day report; harmless.
    - cron: '0 13 * * 1-5'   # 9:00 AM ET (daylight saving)
    - cron: '0 14 * * 1-5'   # 9:00 AM ET (standard time)
  workflow_dispatch:           # adds a "Run workflow" button for manual runs

# Allow the action to commit the generated report back to the repo
permissions:
  contents: write

jobs:
  build-report:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generate the report
        env:
          FINNHUB_KEY: ${{ secrets.FINNHUB_KEY }}
        run: node scripts/build-report.js

      - name: Commit report.json
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add report.json
          git commit -m "Daily market signal report ($(date -u +%Y-%m-%d))" || echo "No changes to commit"
          git push
