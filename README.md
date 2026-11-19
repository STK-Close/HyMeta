# HyMeta

Playpacks for Hytale: sets of mods picked to work well together, one for every way you like to play.
Pick a playstyle, see the mods, and get playing in as few taps as possible.

Owned and built by **Lumina Art House, LLC**. &copy; 2026 Lumina Art House, LLC. All rights reserved.
HyMeta is an unofficial fan app. It is not affiliated with Hytale, Hypixel Studios, CurseForge or Overwolf.

## Where things stand

HyMeta now runs as a private, password-protected test site that shows live Hytale mods from CurseForge.
The playpacks are early recipes, not final picks. Accounts, payments, the weekly playpack generator and
the App Store build are not made yet. Opened without the server (for example as a shared preview page),
the app falls back to sample mods.
See `docs/app-store-checklist.md` for what Apple needs and what is done.

## What is in here

| Folder | What it holds |
| --- | --- |
| `src/app.html` | The app itself, as one page. This is the file to edit. |
| `api/` | The server's routes: the page itself, sign-in, and live mod data. |
| `lib/` | The server's working parts: the password gate, the CurseForge connection and the playpack recipes. `lib/page.js` is the built page. |
| `web/` | Public files only: icons, artwork (`web/images/`) and settings. The app page is deliberately not here. |
| `store/` | The 1024 pixel App Store icon. |
| `docs/` | The Apple approval checklist and the design decisions. |
| `scripts/` | Small helpers that build the page and draw the icons. |
| `tests/check.js` | Opens the app in a real browser at phone, tablet and desktop sizes, in light and dark, and clicks through every flow. |

## For whoever works on the code

```
node scripts/build.js        # rebuild lib/page.js after editing src/app.html
node scripts/make-icons.js   # redraw the icons
node tests/check.js          # run the browser checks (needs Playwright)
node scripts/dev-server.js   # run the site on this computer
```

## Settings the host needs

Two private values, entered in the host's own settings and never written in this repository:

| Name | What it is |
| --- | --- |
| `SITE_PASSWORD` | The password visitors type to get in. With none set, the site stays locked. |
| `CURSEFORGE_API_KEY` | The CurseForge key. With none set, the app shows sample mods. |
| `DATABASE_URL` | The connection address of the Neon database that holds accounts. With none set, accounts stay switched off and the rest of the site works as before. |

## How it follows the CurseForge rules

Every mod is fetched live at the moment someone looks at it, and nothing from CurseForge is stored.
The key stays on the server and is never sent to the browser. Every mod links to its CurseForge page.
See `docs/curseforge-terms.md`.
