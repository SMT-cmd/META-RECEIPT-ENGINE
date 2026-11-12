# Bizlano production reconciliation & release acceptance — 12 November 2026

## Status — deployed, payment charging disabled
- **Production Cloudflare Worker:** `bizlano`, on the account dedicated to Bizlano. Current repository source includes scoped business arms, physical locations, purchasing, inventory transfers, saved document designs, printable payment confirmations, proposed subscriptions, email notifications, and Paystack verification/refund code.
- **Public domain:** https://bizlano.pages.dev, backed by the separate Cloudflare Pages `bizlano` gateway and the Bizlano Worker. GWS infrastructure was not changed.
- **Production D1:** `bizlano-db` — additive migrations 0020 through 0026 applied, including `billing_refunds`.
- **Legacy state:** One tenant and one user remain, one newly seeded primary business arm and one main location; zero issued sales documents, recorded merchant payments, paid subscriptions, or refund records. Historical migration links and 13 preexisting sessions were preserved.
- **Cloudflare Worker bindings retained:** DB, ASSETS and RECEIPT_RECOVERY_KEY. Existing Bizlano resources and original authentication/recovery were not deleted or reset.
- **Scheduler:** Cloudflare Worker cron `0 8 * * *` (UTC). The notification run is no-op without billing activation or explicit campaign approval.
- **Payment safety:** `BILLING_LIVE = false` in `platform/worker/subscription.mjs`. Neither TEST nor LIVE subscription checkout is active. No financial action or announcement was triggered.

## Recovery points — private, not public URLs
- Cloudflare D1 Time Travel bookmark captured before changes: `0000003b-00000000-00005121-a0e1769ccec1d6dd602465121c7cc17d`.
- Private R2 snapshot: `private-backups/d1/bizlano-production-pre-reconciliation-2026-11-12.json` (schema and data for 36 preexisting application tables; backup contains sensitive account/session records, never publish its contents). D1 Time Travel is the recovery option for an entire database rollback.
- Original live Worker saved privately to `private-backups/workers/bizlano-live-before-reconciliation-2026-11-12.js`; preceding live version was `7da18eed-9ce1-415b-8306-1bb05f6aa8a5`.
- Public Pages proxy was deployed with verified Origin-only POST protection and signed GWS/Paystack webhook exceptions; production Pages deployment `e196f813-3a71-440b-953f-a9e95f591aec` finished successfully.

## Completed engineering verification
- All 19 ordered migrations, 0001–0026, passed on disposable Cloudflare D1. Six new migrations 0020–0025 plus 0026 were subsequently applied successfully to production.
- On disposable D1: business onboarding auto-created main arm/location; stock transfers preserved total stock; a branch invoice reduced only that location's stock; payment confirmation did not produce another sale or double-deduct stock; duplicate payment proof, over-transfer, and issued-style mutation were rejected; supplier purchase receiving, usage deduplication and dormant entitlement constraints passed.
- Paystack refund journal migration passed reference uniqueness, amount immutability, and delete-prohibition tests.
- Complete bundled Worker, HTML clients, billing and purchasing modules passed JavaScript syntax evaluation before deployment.
- Production postdeploy public routes `/`, `/app`, `/receipts`, `/api/health` all rendered via both Pages gateway and the Worker. `/api/health` returned D1/R2 healthy; anonymous private `/api/me` and `/api/b/nonexistent/billing` returned 401.
- TinyFish read-only desktop browser checked homepage, footer navigation, `/app` login field/button visibility and links to `/receipts`, and reported no visual errors. Dedicated 390px mobile width was not executed.
- Temporary QA databases were deleted. No test accounts, products, invoices, or payments were inserted into production.

## External configuration and owner acceptance still required
1. **Email:** Bizlano's Worker currently has no RESEND_API_KEY or RESEND_FROM_EMAIL. To send account verification and password reset emails, configure a verified sender and Resend API key in the Bizlano Cloudflare account. Do not reuse another business's verified email domain without approval. Test registration, verification, reset and email deliverability. The Resend free tier may be used subject to its limits.
2. **Paystack TEST:** Missing BIZLANO_PAYSTACK_SECRET_KEY, BIZLANO_PAYMENT_MODE, and optional BIZLANO_PAYSTACK_WEBHOOK_SECRET; configure only under controlled TEST acceptance. Payment return URL defaults to `https://bizlano.pages.dev` or a validated BIZLANO_PUBLIC_ORIGIN. Exercise successful, failed, duplicated and out-of-order notifications, partial and full refunds, lapse/renewal, tier usage and credit/discount arithmetic. The production `BILLING_LIVE` gate must remain OFF until acceptance, and production LIVE payments are not needed for engineering QA.
3. **Global Webstores integration:** Existing GWS bridge and order feed preserved. Final signed delivery and active paid-vendor eligibility require the separate GWS integration owner to configure/verify the shared secret and actual paid vendor evidence.
4. **Browser and printer acceptance:** An authenticated owner/staff/buyer walkthrough, business arms, outlets, stock receipt and transfers, quote → invoice → payment proof, customer receipt recovery, all 71 design previews, narrow mobile screen, 58/80 mm POS printing and real PDF export should be checked using the owner's login and devices. The desktop smoke test did not exercise login or submit transactional forms.
5. **Email reminder opt-in:** BIZLANO_BILLING_FROM/BIZLANO_RESEND_API_KEY and sender verification are required for subscription notifications; BIZLANO_ANNOUNCEMENT_APPROVED must remain unset until campaign approval. Confirm bounces/retries before customer mailing.
6. **Price approval:** Free / Lite / Standard / Business / Business Max prices and limits are still proposals for optional 1 February 2027 rollout. No charges or restrictions before a separately approved release.

## Source and deployment rules
- Keep changes on existing GitHub `main`; no GitHub Actions or paid build runners.
- Build with `cd platform/worker && node build.mjs` before deploying. Cloudflare Pages is a separate proxy and needs its own deployment for gateway changes.
- Preserve all existing D1 tenants, sessions, MetaForge legacy links and receipt recovery, and never share private R2 backup contents.
- Do not substitute a browser redirect for verified Paystack payment settlement.
- This document distinguishes source-level/database/public-website completion from the still-unverified authenticated/live financial acceptance tests. Engineering deployments are complete; release acceptance is **not**.