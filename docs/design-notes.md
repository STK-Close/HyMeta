# Design decisions

Decisions made so far, and who made them. Anything marked "Claude's call" is open to change.

## Direction set on November 19, 2026 (from Ligia)
- HyMeta is a website, not an App Store app. Hytale is a desktop game, so the computer is where it matters most. It must still work well on a phone, because people will browse on the go.
- Paying should be as easy as possible, always. On the web that means Stripe Checkout, with cards, Apple Pay and Google Pay. Not built yet.
- With every build, Claude adds one thing nobody asked for and says what it was. So far: "Surprise me" in Explore.
- `docs/app-store-checklist.md` is kept for reference only. Its safety items (review before sharing, report, block, account deletion) are built and stay.

## Payments (Claude's call)
- Stripe, in the name of Lumina Art House, LLC. Ligia's Square account belongs to a different company, Mōsa Print House, LLC, so it is not used.
- Members pay on Stripe's own checkout page (card, Apple Pay, Google Pay) and manage or cancel on Stripe's own portal page. HyMeta never sees a card.
- Only one setting is needed, `STRIPE_SECRET_KEY`. The two prices ($3.99 monthly, $24.99 yearly), the webhook and the portal settings are created in Stripe the first time they are needed.
- Stripe's messages are never trusted as sent. Each one is looked up again with our own key, so a made-up message cannot grant a membership.
- Once the key is set, membership is real: the Free and Member preview switch disappears, and the server refuses members-only playpacks to free accounts. The owner counts as a member without paying.
- A grown-up question sits in front of the payment.
- Not built yet: emails (receipts come from Stripe), and a way to gift or comp a membership.

## Installing (Claude's call, from research)
- CurseForge has no way to take a whole list of Hytale mods at once, and no shareable profiles for Hytale that could be confirmed. So installing is one tap per mod: each tap hands a mod to the CurseForge app with its `curseforge://install` link, and the next mod moves up.
- This link is confirmed for Minecraft and the CurseForge site shows "Install via App" for Hytale mods. It has not been tested on a real computer with the CurseForge app yet.
- Every mod can be ticked off by hand, and each has a link to its CurseForge page as a fallback. Progress is remembered on the device.
- The last step is explained: mods are switched on per world inside Hytale.
- "Send to my computer" makes a real code (four consonants, four digits, good for one day) that opens the same playpack on the computer. Signed-in members also find it under "Waiting for you" on every device.

## The weekly plan (from Ligia)
- Every week brings all-new playpacks to the main area.
- Earlier playpacks leave the main area but stay in the full playpacks area, which keeps growing.
- Favorites stay favorites after their week has passed.
- The full area will need organizing once it is large. Not designed yet.
- This needs each week's playpacks to be kept, which is the storage permission asked of CurseForge.

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
- Every group of mods on a playpack page starts open and says in one line what it is. A closed group reads as "you should not get these".

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
- New playpack artwork is made with fal (FLUX.2), at about 1.2 cents a picture with commercial use allowed. Ligia approved this as the default on November 19, 2026. The prompts and the shared style line live in `scripts/make-art.py`. The spider, factory and hermit pictures were made this way.
- One picture (creatures) is still shared by the cozy farmer and beast friend packs.
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
- Every playpack aims for 8 picks: its own jobs first, then up to three everyday extras that suit any playstyle (item info, a map, bigger bags). Guides for new players suggest starting with 5 to 10 mods, which matches how Ligia plays.
- An extra never repeats a job the playpack already fills.
- Helper mods that a pick cannot run without are found automatically and listed in their own group.
- Mods whose name or description contains a blocked word never appear.
- Free players never trigger a fetch for a locked playpack. Real enforcement arrives with payments.

## Accounts (Claude's call)
- Sign up with an email, a password and a display name, after ticking "I am 13 or older". Sign in with Apple is added when the Apple developer account is ready.
- Passwords are never stored, only a salted hash. Sign-in sessions are stored hashed too, and last 30 days.
- An account holds saved playpacks, saved mods and stamps. Anything saved on a device before signing in is added to the account.
- Deleting an account removes everything in it at once and signs out every device.
- Display names reject links, emails, phone numbers and rude words.
- A signed-in member can build a playpack and send it for review. Only its name, one line and the ids of the chosen mods are kept.
- Nobody but its builder sees a playpack until the owner approves it. The owner is the first account ever made, plus any email listed in `OWNER_EMAILS` in the host's settings.
- The owner's review queue lives under You: approve or decline waiting playpacks, and remove or keep reported ones.
- Reporting a playpack hides it for the reporter at once. Blocking a member hides all of their playpacks. A member can have 5 playpacks waiting and 30 in all.
- Not built yet: password reset by email, and member-only access enforced by the server. The Free and Member switch is still a preview control until payments exist.
- The database is Neon, the same service Heckle uses.

## Not decided
- How one-tap installing will really work for Hytale through CurseForge.
- Whether a paid app is allowed under the CurseForge API terms.
- Whether the artwork made in Perplexity may be used commercially.
- Whether Lumina Art House owns the hymeta.gg web address.
