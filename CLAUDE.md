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

## Always
- Add one extra, unasked-for improvement to each build and tell Ligia what it was.
- Verify the live site (https://hymeta.vercel.app) after pushing, before telling her it is live.
- Never set `SITE_OPEN`. Never put keys or passwords in chat or in the repository (it is public).
- Nothing from CurseForge is stored. New art is made with `scripts/make-art.py` in the chunky block style.
- App text: sentence case, plain words, no em dashes, nothing unsuitable for children.
- Replies start with a short "Start here" summary, and end with "Your next step" only if she must act.
