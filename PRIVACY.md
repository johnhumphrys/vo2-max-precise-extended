# Privacy policy

**VO2 Max Extended for Garmin** ("the extension"), effective 4 October 2026.

In short: the extension does not collect, store, sell or send your data anywhere. It works
inside your browser, on Garmin Connect only.

## What it does with your data

The extension runs only on `https://connect.garmin.com/app/*`, and only while you have a
Garmin Connect page open and are signed in. To show your precise VO2 max it asks Garmin's own
website for the same information the page already loads, using your existing Garmin session:

- your VO2 max values (the latest, and the days in the range you are viewing);
- Garmin's table of VO2 max categories (Superior, Excellent and so on);
- your profile settings, from which it reads **only your gender and date of birth**, to work
  out which age and sex band applies to you. Every other profile field is ignored and thrown
  away immediately.

This information is held in memory while the page is open, to draw the number, the chart and
the ranges list. It is never written to disk, browser storage, cookies or any database, and it
is gone when you close or reload the tab. Your date of birth is used only to calculate your age
band and is never displayed or kept.

## What it does not do

- It does not send any data to the developer or to any third party. Its only network requests
  go to `connect.garmin.com`, the site you are already on.
- It has no analytics, tracking, advertising or remote code.
- It does not read other websites, your browsing history, or any Garmin page outside
  `/app/*`.
- It does not store or sync anything, and it asks for no browser permissions beyond running on
  the Garmin Connect pages above.

## Exports

When you click an export button, the extension builds a CSV or JSON file in your browser from
your VO2 max data and saves it to your computer. The file never leaves your device unless you
choose to share it.

## Changes and contact

If this policy changes, the new version will appear in this repository, with the history of
every change. Questions or concerns: open an issue at
https://github.com/johnhumphrys/vo2-max-precise-extended/issues.

This extension is unofficial and is not affiliated with, endorsed by or sponsored by Garmin
Ltd. Garmin and Garmin Connect are trademarks of Garmin Ltd.
