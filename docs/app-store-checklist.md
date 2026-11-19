# App Store approval checklist

What Apple needs before HyMeta can be approved, and where each item stands.
Source: Apple's App Store Review Guidelines, read on November 18, 2026
(https://developer.apple.com/app-store/review/guidelines/). The first part of the page
(sections 1 and 2) was read word for word. Sections 3, 4 and 5 were read as a summary, so their
exact wording should be checked again before submitting. This is not legal advice.

Status key: **Designed** = already in the preview. **Build** = needs the real app. **You** = needs Ligia.

## Shared playpacks (guideline 1.2, user-generated content)

| Apple requires | Status |
| --- | --- |
| A way to filter objectionable material | **Designed**: every shared playpack waits for a person to approve it before other members see it, and links, emails and phone numbers are rejected. **Build**: a real word filter and the review inbox. |
| A way to report offensive content, with timely responses | **Designed**: "Report this playpack" on every shared pack, with a 24 hour promise. **Build**: the inbox the reports go to. **You**: someone to answer them. |
| A way to block abusive users | **Designed**: "Block this member", plus a list of blocked members under You, Account. |
| Published contact information | **Designed**: Help and contact page. **You**: a support email address. |

## Children (guidelines 1.3, 5.1.4, 2.3.8)

| Apple requires | Status |
| --- | --- |
| Do not use the Kids Category unless the app meets its stricter rules | Recommendation: do **not** list in the Kids Category. List as a general app that is safe for younger players. |
| Do not suggest children are the main audience in the name, icon, screenshots or description of a non-Kids app | **You / Build**: keep this in mind when writing the store listing. |
| Follow children's privacy law when collecting data from a minor | **Designed**: accounts and sharing are for ages 13 and up, and anyone can browse without an account. **You**: have a lawyer confirm this plan. |
| Store listing must suit a 4+ rating | **Build**: screenshots and description stay clean. |
| Parental gate before purchases | Only required inside the Kids Category. **Designed** anyway: a grown-up question before the membership purchase. |

## Membership (guidelines 3.1.1, 3.1.2, 2.3.2)

| Apple requires | Status |
| --- | --- |
| Unlocking features must use Apple in-app purchase | **Build**. Apple keeps a share of each sale. |
| A way to restore purchases | **Designed**: "Restore purchases" on the membership sheet and under You. **Build**: make it work. |
| Say clearly what the price buys before asking | **Designed**: perks list, both prices ($3.99 a month, $24.99 a year), renewal wording, links to Terms and Privacy. |
| Subscription lasts at least seven days and gives ongoing value | Planned: monthly and yearly, with a new playpack every week. |
| Mention the subscription in the store description and screenshots | **Build**: store listing. |
| Apple's standard subscription wording (Schedule 2 of the developer agreement) | **Build**: not read yet, check before submitting. |

## Accounts and privacy (guidelines 5.1.1, 4.8)

| Apple requires | Status |
| --- | --- |
| A privacy policy linked in the app and on the store page | **Designed**: draft in the app. **You**: lawyer review, and a public web address for it. |
| Account deletion inside the app | **Built**: You, Account, Delete my account (two taps) removes the account and everything in it. |
| If a third-party sign-in is offered, also offer one that limits data to name and email and lets people hide their email | **Designed**: Sign in with Apple plus email. **Build**. |
| Privacy details on the store page | **Build**: fill in from what the real app collects. Plan: no ads, no tracking, nothing sold. |

## Other people's names and artwork (guideline 5.2)

| Apple requires | Status |
| --- | --- |
| Permission to use third-party trademarks and copyrighted work | **You**: check Hypixel Studios' rules for fan projects, including the "Hy" in the name. **Designed**: "unofficial, not affiliated" on every page, and no Hytale art, logo or fonts. |
| Rights to the artwork used in the app and the store listing (2.3.9) | **You**: the playpack artwork was generated in Perplexity. Check their terms allow commercial use. |
| Content from another service must be allowed by that service's terms | **You**: confirm with CurseForge that a paid app may show mod names, logos and links through their official API. This is the biggest open risk. |

## A real app, finished (guidelines 2.1, 2.3, 4.2)

| Apple requires | Status |
| --- | --- |
| No placeholder content, working links, back end switched on | **Build**: replace every sample mod with real CurseForge data. |
| A demo account for the reviewer, with purchases visible and working | **Build**. |
| More than a repackaged website or a list of links | **Build**: saved items, the stamp card, building and sharing, weekly notifications and send-to-computer make it an app in its own right. |
| Accurate screenshots, description and age rating answers | **Build / You**. |
| App icon, 1024 pixels, no transparency | **Designed**: `store/app-icon-1024.png` (placeholder art, to be redrawn). |

## What Ligia needs to supply

1. An Apple Developer account in the name of Lumina Art House, LLC (the same one as your other apps, if you have it).
2. A support email address and a public web address for the privacy policy.
3. Done: the membership price is $3.99 a month or $24.99 a year. Enroll in Apple's Small Business Program so Apple keeps 15% instead of 30%.
4. Your CurseForge API key, entered through the secure form, never pasted into chat.
5. Written confirmation from CurseForge that a paid app is allowed.
6. A look at Hypixel Studios' fan content rules, or permission from them.
7. A lawyer's review of the privacy policy, terms and the plan for players under 13.
8. A check of Perplexity's terms to confirm the artwork can be used commercially.
9. A Mac with Xcode, or a cloud build service, to produce and upload the iPhone app.
