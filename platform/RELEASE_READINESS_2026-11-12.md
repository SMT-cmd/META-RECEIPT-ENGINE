# Bizlano source implementation and release handoff — 12 November 2026

Status: committed to main. NOT YET DEPLOYED to the live Cloudflare Worker or production D1. Subscription charging remains disabled.

## Implemented in repository
- Multi-tenant businesses and business arms, with independent names, document prefixes, footers and saved design profiles.
- Physical locations: shops, offices, service bases and warehouses, stock by location, safe transfers and staff location scopes.
- Supplier directory, multi-line draft purchase orders, stock receiving exactly once, cancellation and stock updates without extra customer sales.
- Quote/estimate/proforma-to-invoice lineage, invoice payments and printable immutable payment confirmations; one economic sale counted once.
- Issued-document immutable appearance snapshots and all 71 template previews, with per-plan saved-profile infrastructure.
- Owner billing page, five proposed subscription tiers, dormant server-enforced entitlements, GWS discount lookup, prepaid Paystack payment handlers and verification, scheduled expiry and email outbox.

## Executed verification
- All 18 ordered D1 SQL migrations through 0025_procurement.sql succeeded in disposable Cloudflare D1 databases; temporary databases deleted after testing.
- Stock transfer, location-specific invoice deduction, paid-document reversal, supplier receiving, duplicate receiving and stock ledger checks passed.
- Unique transaction ID usage, optional active plan quota checks, excess-location limits, immutable proof receipts and immutable document styling checks passed.
- Full self-contained 559,626-character Worker JS (including modules) plus dashboard and customer JS passed JS syntax compilation. This is not a full functional browser test or a production deployment.

## Open acceptance gates (not complete)
1. Compare production Worker with GitHub build, preserve production Firebase/native authentication and existing MetaForge receipt recovery before updating Worker.
2. Take a production D1 backup, apply additive migrations in sequence, test on the dedicated Bizlano account, and provide recovery instructions.
3. Run full local Node test suite, authentication/roles/tenant boundaries, all document styles and mobile/POS printer user journeys.
4. Validate the separate GWS order feed and VERIFIED ACTIVE PAID vendor discount with the GWS integration owner. Pairing alone does not qualify.
5. Test Paystack in TEST mode end to end (duplicate/out-of-order webhooks, declined payments, cancellations, refunds, plan renewal/expiry) before approval.
6. Verify verified-domain emails, sender authorization, provider quotas, cron delivery, mail retries and bounced-mail behavior.
7. Approve plan prices and allowances; run owner live acceptance. Paid subscriptions target 1 February 2027 ONLY if release gates are met.

Billing release is a two-factor authorization: hard-coded BILLING_LIVE=false plus environment BIZLANO_BILLING_APPROVED='yes'; no one should flip them without live TEST acceptance. Free records must remain readable after cancellation or expiry. One working branch (main), free-first tools and no GitHub Actions.