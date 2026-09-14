schema: gentle-ai.sdd-research/v1
revision: 2
request_id: beacon-mvp-research-001
change: beacon-mvp
outcome: done
requested_source_classes:
  - documentation
  - open-web

## Questions

1. Email delivery provider for a Node.js/NestJS backend MVP: compare at least 2-3 concrete providers (e.g. Resend, SendGrid, AWS SES, Postmark) on official Node/TypeScript SDK availability, minimal integration shape (API call vs SMTP), free tier / MVP-relevant pricing, deliverability reputation notes, and NestJS-specific integration guidance.
2. Push notification provider for a backend-only MVP sender: compare at least 2 concrete options (e.g. Firebase Cloud Messaging / FCM, OneSignal, native APNs) on Node SDK availability, whether a mobile client SDK counterpart is required, free tier, and integration complexity.
3. Discord delivery mechanism: compare a Discord webhook (simple HTTP POST, no bot infrastructure) vs a Discord bot (via discord.js or similar, persistent connection/bot token) for a fire-and-forget "send this notification" use case, and state which is simpler vs which is needed only for richer interaction.
4. Per channel, a clear MVP recommendation (pick one), plus which single channel to build FIRST for the MVP and why (fastest path to a working end-to-end demo).

## Product context (non-authoritative — for framing only, not a research target)

Beacon is an internal platform notification service (NestJS/TypeScript). Other internal apps (e.g. "Gardenia") publish an event to a Kafka topic carrying channel, content, and the deliverable address (the caller already knows the email/push-token/Discord-ID — Beacon does not do address lookup). Beacon consumes the event asynchronously and delivers via one of three channels: EMAIL, PUSH, DISCORD. Bias findings toward "fastest to integrate correctly, lowest operational overhead" over "most features."

## Executive Summary

Across email, push, and Discord, the fastest-to-integrate options for an async, backend-only notification MVP are: **Resend** for email (official Node SDK, single API call, 3,000/mo free, 100/day cap, no sandbox-approval friction unlike SES); **FCM via Firebase Admin SDK** for push (free, official Node SDK, but strictly requires a client-side mobile SDK already embedded in the receiving app — a hard external dependency Beacon does not control); and a **Discord webhook** (plain HTTP POST, no bot token, no persistent connection) for Discord, clearly simpler than a discord.js bot for fire-and-forget delivery. SendGrid's free tier was downgraded to a 60-day trial (source conflict noted); AWS SES has the lowest per-email cost but adds sandbox-approval latency (1-3 days) unsuitable for a fast MVP; Postmark has no free production tier and the highest deliverability reputation. OneSignal requires the same mobile-SDK client dependency as raw FCM, adding no MVP advantage over FCM while adding a third-party platform dependency.

**Recommended MVP picks:** EMAIL → Resend; PUSH → Firebase Cloud Messaging (Admin SDK) — but only viable once the client apps embed the FCM client SDK; DISCORD → Webhook (no bot). **Build Discord FIRST** — it requires zero external account approval, zero client-side dependency, and a single HTTP POST, making it the fastest path to a working end-to-end demo of Beacon's consume-and-deliver flow.

## Sources

| id | class | title | publisher | url | accessed_at |
|---|---|---|---|---|---|
| S1 | documentation | Resend — Send with Node.js | Resend | https://resend.com/docs/send-with-nodejs | 2026-09-11 |
| S2 | documentation | Resend Pricing | Resend | https://resend.com/pricing | 2026-09-11 |
| S3 | documentation | Amazon SES Pricing | AWS | https://aws.amazon.com/ses/pricing/ | 2026-09-11 |
| S4 | documentation | Send emails with Node.js (Postmark) | Postmark (ActiveCampaign) | https://postmarkapp.com/send-email/node | 2026-09-11 |
| S5 | documentation | Cloud Messaging — Server environment / send messages | Google Firebase | https://firebase.google.com/docs/cloud-messaging/server | 2026-09-11 |
| S6 | open-web | OneSignal Mobile SDK reference / Developers docs | OneSignal | https://documentation.onesignal.com/docs/en/mobile-sdk-reference | 2026-09-11 |
| S7 | documentation | Discord Developer Docs — Webhook Resource | Discord | https://docs.discord.com/developers/resources/webhook | 2026-09-11 |
| S8 | open-web | discord.js Guide — Webhooks / Discord bot vs webhook analysis | discordjs.guide ; discord-webhook.com | https://discordjs.guide/legacy/popular-topics/webhooks ; https://discord-webhook.com/en/blog/discord-bot-vs-webhook/ | 2026-09-11 |

Note: SendGrid free-tier pricing came from third-party aggregator search snippets only (no official SendGrid pricing page fetch succeeded); treated as lower-confidence and flagged in Gaps.

## Claims

**Q1 — Email provider comparison**
- Resend has an official `resend` npm package; minimal send is one async call `resend.emails.send({...})` — no SMTP config needed. [S1] Free tier: 3,000 emails/mo capped at 100/day; Pro tier $20/mo for 50,000 emails/mo, removes daily cap. [S2] No official NestJS-specific guide found; integration is framework-agnostic. [S1]
- AWS SES has the lowest raw per-email cost (~$0.10–$0.16 per 1,000 emails) but new accounts start in sandbox mode, restricted to verified recipients until manual production-access approval (reported 1-3 day turnaround by third-party sources; not confirmed on the official pricing page). [S3]
- Postmark ships an official `postmark` npm package; minimal send via API or SMTP "so you can start sending in minutes." [S4] No permanent free production tier (test-only allowance); paid plans start ~$15/mo for 10,000 emails; third-party testing cites it as top-rated for inbox placement (open-web sourced).
- SendGrid has an official Node.js library. Free-tier status is contradictory across open-web sources (permanent 100/day vs. 60-day trial only) — unresolved source conflict, not confirmed against an official SendGrid pricing page.

**Q2 — Push provider comparison**
- FCM: official Firebase Admin SDK for Node.js is Google's recommended server-side path. Sending requires a device registration token, obtainable only via a client-side FCM SDK already embedded in the receiving app — a hard prerequisite outside Beacon's backend control. [S5]
- OneSignal: also requires its own client-side SDK integrated into the receiving app before server-side sends can reach a device — same underlying constraint as FCM, plus an added third-party platform layer. [S6]
- OneSignal free plan is $0/mo; per third-party reporting a 1,000 MAU/month limit for mobile push begins rolling out Sept–Oct 2026 (open-web sourced, not confirmed on an official pricing page).

**Q3 — Discord webhook vs bot**
- A Discord webhook needs no bot user, no bot token, no auth beyond the webhook URL; single `POST /webhooks/{id}/{token}` with JSON body. [S7]
- A Discord bot requires an application, bot token, and a persistent gateway (WebSocket) connection via discord.js — necessary only for two-way interaction, not one-way notification delivery. [S8]
- For fire-and-forget notification delivery, the webhook is unambiguously simpler; a bot is needed only for richer/interactive behavior. [S8]

**Q4 — Per-channel MVP recommendation and build-first order**
- Recommended picks: Resend (email), FCM/Firebase Admin SDK (push), Discord webhook (Discord). [S1][S2][S5][S7]
- Discord is fastest to a working end-to-end demo: zero external approval step, zero dependency on code outside Beacon's own repo (no client SDK, no sandbox approval, no domain/sender verification) — contrasted with SES's sandbox delay and both FCM's and OneSignal's mandatory external client-SDK dependency. [S3][S5][S6][S7]

## Gaps

- No official SendGrid pricing/docs page was successfully fetched; free-tier permanent-vs-trial conflict unresolved.
- AWS SES sandbox-approval turnaround (1-3 days) is open-web sourced only, not confirmed against an official AWS doc page.
- No official NestJS-specific integration guide was found for any email provider — all integration guidance is generic Node.js.
- OneSignal's official pricing/overview pages returned HTTP 404 in this session; free-tier/MAU-limit details rely on third-party aggregators.
- Deliverability reputation claims (Postmark, SendGrid) come from independent third-party testing sites, not the providers' own docs — directional, not authoritative.

## Risks

- Acting on the SendGrid free-tier claim without verifying against SendGrid's own current pricing page risks a wrong MVP-cost assumption.
- FCM/OneSignal both assume Beacon's internal client apps already integrate the relevant mobile push SDK; if not true today, PUSH cannot ship end-to-end regardless of server-side provider choice — a blocking external dependency, not a Beacon-side implementation choice.
- AWS SES sandbox approval, if it takes 1-3 business days as reported, would materially delay SES-based email delivery for an MVP timeline — verify directly in the AWS console before committing to SES.

## Product choices (non-authoritative — orchestrator/user owns these, not this research)

- Channel(s) to ship in v1, and build order, are still an open product decision pending user confirmation (research surfaces Discord-first as the fastest path, does not decide it).
