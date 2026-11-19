# Design decisions

Decisions made so far, and who made them. Anything marked "Claude's call" is open to change.

## From Ligia
- Free tier: one full playpack a week, plus three teasers with a description but no mods or links.
- Paid tier: every playpack, saved favorites, building and sharing your own.
- Always include one experimental playpack.
- Mod cards show what people know from CurseForge: logo, name, author, description, category, downloads, last update, link.
- Voice: gamified, jovial, a bit unhinged, never any swearing. Children will use it.
- The host is a mascot, not the logo. She does not sit in the top bar or greet you at the top of the home screen.
- Playpack cards stay compact on phones.
- Saved has two areas: playpacks and mods.
- Building a playpack needs a mod search.
- Light mode cards must stand clearly apart from the page.
- Membership costs $3.99 a month or $24.99 a year. No weekly plan and no free trial at launch.
- Saved playpacks can be removed with the heart right in the Saved area, the same as saved mods.

## Carried over from the first HyMeta (built in Perplexity, March and April 2026)
- Seven playstyle families: combat, building, survival, creatures and farming, magic, exploration, a bit of everything.
- The eight pieces of blocky artwork: one landscape and one scene per family. They are the banner art for playpacks and the playstyle tiles.
- Mod spotlight: one featured mod on the home screen.
- Shared playpacks hold 3 to 20 mods and wait for a person to approve them before other members see them.
- Accounts and sharing are for ages 13 and up. Anyone can browse.
- Florida law governs the terms.
- Theme ideas for the weekly generator: Monster hunter, Rising stars, Pet paradise, Hidden gems, Speedrunner's toolkit, Medieval life, Total overhaul, Social butterfly, Lore master. It made two or three new packs a week and avoided themes used recently.

## Left behind from the first HyMeta
- The $1.49 price, daily rotation and Stripe payments.
- "All sales are final" and account deletion by email, which Apple does not accept.
- The mention of Riot Games, which has no connection to Hytale.
- The engine itself. Only the screens were recoverable without paying for Perplexity Pro.

## Claude's call
- Host name: Hex, a troll cousin of Heckle. Three moods (gentle, cheeky, unhinged), all clean.
- Logo: a pixel backpack, for "playpack". Placeholder quality, to be redrawn.
- Dare levels: cozy, spicy, send help.
- Stamp card: one stamp per playstyle survived, with ranks.
- Look: a game storefront at night. One key-art banner per screen, compact rows on phones, a tight grid on wide screens. Navy and gold base, hot pink only for warnings and experimental packs. Nothing taken from Hytale.
- Each playpack keeps a small pixel crest in the corner of its artwork, so packs that share a picture can still be told apart.
- Two pictures are each used by two playpacks (creatures and building) until more artwork exists. The spider, factory and hermit packs most need their own.
- Phones cannot run Hytale, so the phone offers "Send to my computer" and the computer offers "Add all mods".
- A grown-up question sits in front of the membership purchase.
- Shared playpacks reject links, emails and phone numbers, and can be reported or their author blocked.

## How the test site works (Claude's call)
- Hosted on Vercel, behind one shared password, hidden from search engines.
- The app page is only handed out after sign-in, and every data route checks the sign-in too.
- Mods are fetched live from CurseForge and nothing is stored, to stay inside their rules while permission is pending.
- Each playpack is a list of jobs (for the cozy farmer: crops, farm animals, cooking, a cozy home, fishing and seasons). Each job is filled by the best-fitting mod found by live searches.
- A mod earns its place by fit (the job's words in its name or description, whole words only), upkeep (updated recently and marked for the game version most mods support), and trust (downloads).
- Fairness rules: one mod per job, at most two mods per author, nothing needing more than three helper mods, nothing a chosen mod clashes with, nothing that plainly belongs to another playpack, no skin or resource packs, no add-ons for other mods.
- "The spice" jobs skip the most downloaded match and rotate weekly among good lesser-known mods.
- Old mods with no current-version mark are left out. If nothing well-kept does a job, an older mod is used and its card says it may not work.
- Each card says which job the mod was picked for and which game version it is marked for.
- Horror mods are kept out, even from the spider playpack.
- Helper mods that a pick cannot run without are found automatically and listed in their own group.
- Mods whose name or description contains a blocked word never appear.
- Free players never trigger a fetch for a locked playpack. Real enforcement arrives with accounts.

## Not decided
- How one-tap installing will really work for Hytale through CurseForge.
- Whether a paid app is allowed under the CurseForge API terms.
- Whether the artwork made in Perplexity may be used commercially.
- Whether Lumina Art House owns the hymeta.gg web address.
