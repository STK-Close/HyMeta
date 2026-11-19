# Before the site is opened to everyone

The site is private until `SITE_OPEN` is set to `1` in the host's settings. Setting it takes the
password away: strangers see the front door, tap "Come in", and are in. Tick these off first.

## Only Ligia can do these
- [ ] Finish Stripe's business questions and replace the test key with the live key (`sk_live_...`) in `STRIPE_SECRET_KEY`.
- [ ] In Stripe, set the statement descriptor to **LUMINA ART HOUSE** and the shortened descriptor to **LUMINA**. Stripe insists the main one resembles the business name. HyMeta adds its own name to each charge, so statements should read along the lines of "LUMINA* HYMETA". Check a real statement after the first live payment.
- [ ] A lawyer reads the privacy policy, the terms, the community rules and the 13-and-up rule.
- [ ] An accountant says where sales tax applies to memberships. Stripe Tax can then be switched on.
- [ ] A support email address, added to the Help and contact page.
- [ ] Check Perplexity's terms allow commercial use of the eight original pictures. The four newer ones were made with fal, which allows it.
- [ ] Check Hypixel Studios' rules for fan sites, including the "Hy" in the name.

## Waiting on CurseForge
- [ ] Their written answer on a paid site, on storing mod details, and on not being treated as a competitor.
      Opening with live recipes is possible without it. Keeping each week's playpacks as an archive is not.
- [ ] Opening to the public means many more requests to CurseForge with one key. Ask them about usage limits.

## Claude can build these
- [ ] Privacy policy and terms readable from the front door, without entering the site.
- [ ] Password reset and the weekly email (needs a free email-sending account).
- [ ] The weekly playpack generator and archive (needs CurseForge's answer).
- [ ] Decide whether search engines may list the site. It is hidden from them today, even when open.
- [ ] A way to be told when a playpack is waiting for review.

## How to open, and how to close again
- Open: add `SITE_OPEN` = `1` under Settings, Environment Variables in Vercel, then redeploy.
- Close: delete `SITE_OPEN`, then redeploy. The password is needed again at once.
- Preview the front door any time, signed in or not, by adding `?door=1` to the address.
