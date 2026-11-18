# HyMeta

Playpacks for Hytale: sets of mods picked to work well together, one for every way you like to play.
Pick a playstyle, see the mods, and get playing in as few taps as possible.

Owned and built by **Lumina Art House, LLC**. &copy; 2026 Lumina Art House, LLC. All rights reserved.
HyMeta is an unofficial fan app. It is not affiliated with Hytale, Hypixel Studios, CurseForge or Overwolf.

## Where things stand

This is a clickable preview used to settle the design. Every mod, number and picture is a placeholder.
Accounts, payments, the weekly CurseForge check and the App Store build are not made yet.
See `docs/app-store-checklist.md` for what Apple needs and what is done.

## What is in here

| Folder | What it holds |
| --- | --- |
| `src/app.html` | The app itself, as one page. This is the file to edit. |
| `web/` | The finished web page, icons, artwork (`web/images/`) and settings, built from `src/app.html`. |
| `store/` | The 1024 pixel App Store icon. |
| `docs/` | The Apple approval checklist and the design decisions. |
| `scripts/` | Small helpers that build the page and draw the icons. |
| `tests/check.js` | Opens the app in a real browser at phone, tablet and desktop sizes, in light and dark, and clicks through every flow. |

## For whoever works on the code

```
node scripts/build.js        # rebuild web/index.html after editing src/app.html
node scripts/make-icons.js   # redraw the icons
node tests/check.js          # run the browser checks (needs Playwright)
```
