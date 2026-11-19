# Before the site is opened to everyone

The site is private until `SITE_OPEN` is set to `1` in the host's settings. Setting it takes the
password away: strangers see the front door, tap "Come in", and are in. Tick these off first.

## Only Ligia can do these
- [ ] Finish Stripe's business questions and replace the test key with the live key (`sk_live_...`) in `STRIPE_SECRET_KEY`.
- [ ] In Stripe, set the statement descriptor to **LUMINA ART HOUSE** and the shortened descriptor to **LUMINA**. Stripe insists the main one resembles the business name. HyMeta adds its own name to each charge, so statements should read along the lines of "LUMINA* HYMETA". Check a real statement after the first live payment.
- [ ] A lawyer reads the privacy policy, the terms, the community rules and the 13-and-up rule.
- [ ] An accountant says where sales tax applies to memberships. Stripe Tax can then be switched on.
- [ ] A support email address, added to the Help and contact page.
- [ ] Connect an email service so password reset and the weekly email switch on (see "Email" below).
- [ ] Check Perplexity's terms allow commercial use of the eight original pictures. The four newer ones were made with fal, which allows it.
- [ ] Check Hypixel Studios' rules for fan sites, including the "Hy" in the name.

## Waiting on CurseForge
- [ ] Their written answer on a paid site, on storing mod details, and on not being treated as a competitor.
      Opening with live recipes is possible without it. Keeping each week's playpacks as an archive is not.
- [ ] Opening to the public means many more requests to CurseForge with one key. Ask them about usage limits.

## Claude can build these
- [x] Privacy policy and terms readable from the front door, without entering the site
      (`/terms.html`, `/privacy.html`, `/rules.html`, `/help.html`, `/credits.html`).
- [x] Password reset and the weekly email. Built and tested, waiting for an email service to be connected.
- [x] The weekly switch: a brand-new free playpack every Monday at 09:00 UTC, twelve weeks' worth, starting
      16 November 2026 (`WEEKLY` in `src/app.html`, recipes in `lib/recipes.js`, the calendar in `lib/weeks.js`).
      Nothing is stored, so it does not wait on CurseForge. **The list runs out after the week of 1 February 2027.**
      After that every playpack takes a turn at being free until more are written.
- [ ] A record of exactly which mods were in each past week (needs CurseForge's answer).
- [ ] Decide whether search engines may list the site. It is hidden from them today, even when open.
- [x] A way to be told when a playpack is waiting for review: an email to the owner, at most one an hour (needs the email service).

## Pages anyone can see, even while the site is private
- The front door (`/`), the legal pages, and one page per playpack for shared links (`/p/<playpack>`).
- A shared-link page shows only HyMeta's own picture and words for that playpack, so link previews work in
  Discord and Messages. It never shows mods, and never a playpack before its week.
- All of them tell search engines not to list them.

## Email
Off until these are added under Settings, Environment Variables in Vercel, followed by a redeploy.
- `BREVO_API_KEY`: the key from a free Brevo account (300 emails a day, checked November 2026). `RESEND_API_KEY` works instead.
- `MAIL_FROM`: the address the emails come from. It must be verified with the email service.
- `MAIL_ADDRESS`: Lumina Art House's postal address. United States law (CAN-SPAM) requires one on every
  newsletter, so the weekly email stays off without it. Password reset works without it.
- HyMeta stops itself at 280 emails a day with Brevo (90 with Resend), and the weekly email stops 20 short of
  that so password resets always get through. `MAIL_DAILY_CAP` changes the number.
- The weekly email goes out once a day at 16:00 UTC to anyone who asked for it and has not had the current issue.
  An issue is the playpack that is free right now (`FREE_PACK` in `lib/recipes.js`), so nobody is emailed again
  until that changes.

## How to open, and how to close again
- Open: add `SITE_OPEN` = `1` under Settings, Environment Variables in Vercel, then redeploy.
- Close: delete `SITE_OPEN`, then redeploy. The password is needed again at once.
- Preview the front door any time, signed in or not, by adding `?door=1` to the address.
