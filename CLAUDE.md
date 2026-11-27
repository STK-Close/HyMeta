# Standing instructions for HyMeta

Owner: Ligia, Lumina Art House, LLC. She is not a developer: plain language, results not code.

## Look at every change on a phone and on a desktop before saying it is done
Asked for by Ligia after a button bar and a filter row shipped broken on her phone.
- Run `npm test`. `tests/check.js` opens the site at phone (390px), tablet (820px) and desktop (1366px),
  in light and dark, and on the smallest phones (320px) for the playpack button bar.
- Then **look at screenshots yourself** at phone and desktop size for every screen the change touched
  (`node tests/check.js <folder>` saves them, or take your own). Passing tests are not enough: the tests
  only catch what someone thought to check.
- Anything pinned to the screen (the tab bar, the button bar under a playpack, sheets) needs extra care.
  It can run off the edge without the page scrolling sideways.
- Adding a button, a filter or a label to an existing row? Check that row at 390px and 320px.
- Say plainly what could not be tested (a real phone, the live signed-in screens).

## Compact, simple layouts (Ligia's rule for all her apps, November 2026)
"Use professional layout skills to rework these so it's more compact and simplistic while retaining or
improving functionality." She said it about the list of mods in a playpack, which ran very long on a phone.
- A list of several things is a list of short rows, not a stack of tall cards. One row shows the name and the
  one fact worth knowing. Everything else opens on a tap.
- Anything that changes what a person would do (new, older, reported, locked) stays visible on the closed row, in words.
- Count the screens: eight items should fit in about one phone screen.
- Hex says one thing at a time. A second thing waits behind a tap on her.
- Nothing is removed to save space. It is folded away, and still reachable by tap and by keyboard.

## Tests must prove themselves
Whenever a check is added or changed, show it fails on a version with the bug and passes on the fixed one.

## The weekly run
Every Thursday a scheduled session writes next Monday's playpack: it reads the players' vote, scouts what
is new on CurseForge, writes the recipe and Hex's words, makes the picture, tests, and pushes.
`docs/weekly-run.md` is the whole procedure. `scripts/add-weekly.js --status` says where things stand.
A playpack whose week is settled (`lib/ledger.json`) is never moved or edited.

## The advert kit (Ligia, November 2026: "I bet you could build something better")
`node scripts/make-promo.js` draws every advert into `promo/out/` (wide for Discord, Reddit and X; square and tall
for Instagram and Pinterest) and `promo/index.html` shows them all with words to post. It replaced a trial of an
outside screenshot tool. The look and the general adverts' wording live in `promo/promo.config.js`.
The drawing and checking is done by the shared promo maker, which Ligia's other apps use too. HyMeta holds a copy
in `promo/tool/`: never edit it here. Change github.com/STK-Close/promo-maker, then run its `install.js` on this
project, redraw, and run `npm test`.
- Adverts say only what HyMeta wrote: the playpack's name, blurb and Hex's line, and `promo.config.js`. Never a mod's
  name, logo or numbers (still waiting for CurseForge's written answer). `tests/promo.test.js` enforces this.
- Site screenshots come from the sample mode and are cropped above the list of mods.
- "Hytale" only describes what the site is for. Every advert carries "An unofficial fan site".
- Hex's large poses are in `promo/hex/`, made by `python3 promo/tool/make-mascot.py <pose>` from `promo/poses.json` (about 2 cents a pose, an estimate).
  Ligia approved all six (present, wave, peek, point, smug, parcels) on November 21, 2026. Show her any new pose
  before it is used.
- Ligia looks at the kit through a private page: https://claude.ai/artifact/TXy75CVURP7sjkmjEHS96J. It shows
  `promo/kit-page.html`. Refresh it the way `docs/weekly-run.md` step 7 says, always to that same address.
- Posting (Ligia, November 27, 2026, launch campaign): Claude may post launch content that passed the rules check,
  and nothing else. The rules check is a separate reviewer agent reading each post against these rules (child safe,
  "An unofficial fan site", no mod names, logos or numbers) plus a check that its link opens. Posts go out from
  HyMeta's own launch sheet and HyMeta's own connected accounts only. A playpack's advert goes out in its own week,
  not before: teasers show the site and what membership gets you, never an upcoming playpack.
- When the site's address changes, change `site` in `promo/promo.config.js` and run the command again.

## Always
- Extra, unasked-for improvements are paused (Ligia, November 26, 2026: "it's in a good spot"). Do not add any
  until she asks for them to restart. When restarted: add one to each build and tell her what it was.
- Verify the live site (https://hymeta.vercel.app) after pushing, before telling her it is live.
- Never set `SITE_OPEN`. Never put keys or passwords in chat or in the repository (it is public).
- Nothing from CurseForge is stored. New art is made with `scripts/make-art.py` in the chunky block style.
- App text: sentence case, plain words, no em dashes, nothing unsuitable for children.
- Replies start with "# 🟢 Start here" as a large heading, then a short summary (2 to 4 lines). End with "Your next step" only if she must act. (Ligia, November 2026.)
