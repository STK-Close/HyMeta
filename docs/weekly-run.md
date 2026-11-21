# The weekly run

Every Thursday a new playpack is written for the Monday that follows. This is the whole job, start to
finish. It is done by a scheduled Claude session with nobody watching, so follow it exactly, and when
something cannot be done properly, stop and leave things as they are: the reserve playpacks cover any
week the run misses.

Why weekly, and not written far ahead: new Hytale mods appear all the time. A playpack written this
week can be built around mods published this month. One written three months ago cannot.

## Before anything else
1. Read `CLAUDE.md`. Its rules apply to every step here.
2. `node scripts/add-weekly.js --status`. If next Monday is already settled, the job is done: stop.
3. `npm install` if `node_modules` is missing, then `npm test`. If it fails before you have changed
   anything, stop and report. Do not build on a broken site.

CurseForge and fal are reached through this environment's saved credentials:
`NODE_USE_ENV_PROXY=1 CURSEFORGE_API_KEY=proxy-injected node scripts/...` and `python3 scripts/make-art.py ...`
(it sends `Key proxy-injected` by itself). If either is refused, stop and report. Never ask for, print
or store a key.

## 1. See who won the vote
`curl -s https://hymeta.vercel.app/api/mail?poll=1` gives the three ideas and their votes.
- Most votes wins. A tie, or no votes at all, means Hex picks: choose the idea with the best mods behind it.
- The winner's name and one line are a promise to the players who voted. Keep the name. Build what the line describes.

## 2. See what is new
`NODE_USE_ENV_PROXY=1 CURSEFORGE_API_KEY=proxy-injected node scripts/scout.js`
It prints the newest mods, the ones updated this week, and words that turn up in several new mods.
It only prints. **Nothing from CurseForge is ever saved in the repository**: no mod names, ids, numbers
or descriptions, not in code, not in docs, not in commit messages. HyMeta's words are its own.

## 3. Write the playpack
Copy `docs/weekly-example.json` to a scratch file outside the repository and rewrite every part.
- **Recipe.** Four to six jobs adding up to 5 to 7 mods. Each job has words that mean a mod does that
  job (`kw`, matched at the start of a word, so "cat" also matches "catalog": use `avoid` for those) and
  words to search for (`q`). At least one job is `"fresh": true`, so a mod published in the last two
  months gets a place. Put `"skin pack"` on the avoid list.
- **Words.** Name, one-line description, three lines from Hex (gentle, cheeky, unhinged), a caution (`warning`: the second thing she says in her speech bubble)
  and a hint that does not give the name away. Read five existing ones in `src/app.html` first and match
  them: dry, fond, a little unhinged, never cruel. Sentence case, plain words, no long dashes.
  **Children use HyMeta**: no swearing, no horror, no gore, no alcohol, nothing romantic, nothing about
  real people, brands or other games.
- **Picture.** `art` is a new short word. `artPrompt` describes one scene in a sentence or two: a small
  adventurer doing the thing, with warm lights. No writing in the picture. The blocky style is added for you.
- **The next vote.** Three new ideas, each with a name and one teasing line. Before offering an idea,
  search for it with `scripts/scout.js` words or a quick recipe: only offer what could really be built
  next week. Do not offer an idea that lost in the last two votes.

## 4. Add it, then make it good
```
node scripts/add-weekly.js /path/to/your-spec.json
NODE_USE_ENV_PROXY=1 CURSEFORGE_API_KEY=proxy-injected node scripts/try-pack.js <id>
```
The tool refuses anything unsuitable or half-finished and says why. Fix the file and run it again.
`try-pack.js` shows what the recipe really picks today. Read every pick and ask: would a player who
chose this playpack want this mod? Edit the recipe in `lib/recipes.js` (matching words, avoid words)
and try again until:
- there are **8 mods**, and at least 7,
- no more than two carry the "older" flag,
- at least one is a new arrival (if none is, the fresh job found nothing: change its words),
- nothing is off-theme, a translation, a fix for another mod, or unsuitable for children.

If the winning idea cannot reach that after an honest try, run
`node scripts/add-weekly.js --remove <id>`, build the idea that came second instead, and say so in the report.

## 5. Make the picture
In a scratch folder outside the repository:
```
python3 /path/to/repo/scripts/make-art.py <art>
python3 /path/to/repo/scripts/place-art.py <art>
```
Then **look at** `web/images/pack-<art>.jpg`. It must be built from chunky blocks like every other
picture, show the playpack's idea, have no writing in it and nothing frightening. If not, change the
`artPrompt` line in `scripts/make-art.py` and make it again. Three tries at most (each costs about a cent).

Then make its adverts (free, about 20 seconds, nothing is sent anywhere):
```
node scripts/make-promo.js
```
This draws the new playpack's wide, square and tall adverts into `promo/out/` and redraws the general
ones, so the vote advert shows the three new ideas. **Look at** `promo/out/wide/<id>.jpg` and
`promo/out/tall/<id>.jpg`: the name on one line, Hex's line whole, nothing covering the heart of the
picture. The words come from the recipe (name, blurb, Hex's line). If a line does not fit, the command
says so: shorten the line in the recipe, do not touch the advert code. `npm test` fails until the
adverts exist.

## 6. Check it the way CLAUDE.md says
- `npm test` must pass. The tests read the playpack list, so a new playpack needs no test changes.
  If a test fails, the site is wrong, not the test: do not edit tests during a weekly run.
- `node tests/check.js <scratch folder>` and look at the `week-phone-light-*` and `week-desktop-light-*`
  screenshots, and take your own of the new playpack's page, its share card and its public page
  (`/p/<id>`), on a phone-sized and a desktop-sized screen.

## 7. Publish and confirm
Commit everything in one commit ("Add this week's playpack: <name>") and push to `main`. The site
updates itself within a minute or two. Then confirm on the live site:
- `curl -s -o /dev/null -w '%{http_code}' https://hymeta.vercel.app/images/pack-<art>.jpg` gives 200,
- `curl -s -o /dev/null -w '%{http_code}' https://hymeta.vercel.app/p/<id>` gives **404** (it is not Monday yet),
- `curl -s https://hymeta.vercel.app/api/mail?poll=1` shows the three new ideas with no votes.

Nothing else changes for players until Monday 09:00 UTC, when the playpack becomes free and the weekly
email goes out by itself.

## 8. Report
End with a short plain-language note for Ligia: the vote result, the playpack's name and one line,
how many of its mods are new arrivals, the three ideas now up for the vote, the picture, its wide advert
(`promo/out/wide/<id>.jpg`, to post on Monday, not before), what was spent
on pictures, and anything that did not go to plan. If she replies "skip it" before Monday,
`node scripts/add-weekly.js --remove <id>`, `node scripts/make-promo.js` (it deletes that playpack's adverts), test, commit and push.

## Never
- Never change a playpack whose week has begun or is settled (`lib/ledger.json` is the record, and the tests guard it).
- Never edit tests, prices, legal pages, accounts, payments or email during a weekly run.
- Never set `SITE_OPEN`, never touch Vercel or Stripe settings, never open a pull request.
- Never push if `npm test` fails. Never push a picture you have not looked at.
