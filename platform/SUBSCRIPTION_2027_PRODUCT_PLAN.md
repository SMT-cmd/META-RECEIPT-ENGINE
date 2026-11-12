# Bizlano — subscription, business workspace and February 2027 rollout proposal

**Prepared:** 12 November 2026. **Status:** Proposed product/engineering specification, NOT a live entitlement policy or billing activation. **Target:** Open optional paid subscriptions on 1 February 2027, conditional on production acceptance tests. **Infrastructure:** Cloudflare Workers/D1, existing Firebase-compatible live authentication, Paystack for platform subscription payments. Keep a single `main` working branch, free-first tooling and no GitHub Actions.

## Business objective

Bizlano is the **back office for all kinds of businesses**: sales, purchases, inventory, expense records, people, branded documents, payments, customer history, and decisions in one workspace. Global Webstores remains the **marketplace, discovery and storefront**; do not create a redundant Bizlano marketplace. Connecting both should make customer orders and business books agree.

Maintain and enhance all pre-existing MetaForge user receipts, ownership links, business subdomains, and August 2026 original document designs (35 original + 36 newer = 71). Never lock historic data behind a new subscription gate.

## Existing foundation, versus proposed work

In the currently examined repo: multi-tenant D1 schema, membership roles, customer/product/inventory/payment records, document types and templates, historical recovery/migration, print-ready A4/Letter/80 mm/58 mm, and marketplace connection/event tables. **Do not describe the following proposals as already implemented**: paid entitlements, self-service subscription checkout, recurring billing, multiple same-business brands/departments, location stock, purchase order workflows, document conversion approval lifecycle, automated business reports, or production-confirmed full GWS two-way sync. The LIVE worker has Firebase auth divergence from the repository version; preserve live authentication when deploying new features.

## Document model

Support Receipt, Invoice, Quote/Quotation, Estimate, Proforma, Purchase Order, Delivery Note, Credit Note and Debit Note under one document studio. Each document type uses its appropriate terms and fields (invoice: due date and amount owed; estimate: validity/acceptance; receipt: verified received amount; credit note: reference to original). One design profile styles multiple types; types are **not separately billed**.

A document's type is chosen as a draft. Conversions create a new linked document (Estimate -> Invoice -> Receipt, Purchase Order -> Stock Receipt / Bill, Invoice -> Credit Note) with an immutable history, instead of silently rewriting the originally issued receipt or invoice. Distinct numbering sequences and prefix per business/brand/department and document type. Preserve stored PDF appearance or versioned design snapshots for historical documents.

For printing, normal A4/Letter should remain professional and compact rather than overly decorative; roll printers get the appropriate narrow layout. Existing 71 choices remain visibly different and accessible to preview.

## Account hierarchy — three different concepts

1. **Owner account:** One login can access several businesses through a safe business switcher; per-business membership/permissions apply. Never share invoices, customer data or payment ledgers between unrelated legal entities.
2. **Business workspace (tenant/legal entity):** Own legal identification, currency, financial books, customer and vendor references; has its own subscription. Separate legal businesses require distinct tenant ledgers and subscription records. Owner can view a permitted consolidated overview but financials stay partitioned.
3. **Location** = shop/outlet/warehouse with stock and staff scoping. **Department/brand** = distinct customer-facing name/logo, phone, footer, document prefix and saved design profile under one business's ledger. A different arm of the *same* legal business should not be charged as a new legal entity just to use a different receipt header.

Multiple independent business workspaces under the same owner may receive a clearly priced, later-tested multibusiness bundle discount. Do not include a second business as if it were another department. Don't charge for simply adding a user login that belongs to an existing membership.

## Proposed plan pricing (NGN; retain existing discussion)

| Tier | Monthly | 3 months | 6 months | Annual |
|---|---:|---:|---:|---:|
| Free | 0 | 0 | 0 | 0 |
| Lite | 1,000 | 2,800 | 5,400 | 9,600 |
| Standard | 2,400 | 6,700 | 13,000 | 23,000 |
| Business | 4,900 | 13,800 | 26,500 | 47,000 |
| Business Max | 8,900 | 25,000 | 48,000 | 85,000 |

These are **proposals only**, not provider plans or production prices. Keep Standard as the natural recommendation and Free genuinely usable. Pilot actual business unit economics before finalizing. All tiers may use basic receipt, invoice, estimate and quote types.

| Allowance / module | Free | Lite | Standard | Business | Business Max |
|---|---:|---:|---:|---:|---:|
| New issued documents/month | 30 | 150 | 600 | 2,500 | 10,000 |
| Simultaneously saved document design profiles | 1 | 2 | 4 | 8 | 20 |
| Visible/previewable designs | all 71 | all 71 | all 71 | all 71 | all 71 |
| Designs available to save as new profiles | 12 essentials + grandfathered originals | 35 + grandfathered originals | all 71 | all 71 | all 71 |
| Staff seats per workspace | 1 | 1 | 3 | 8 | 15 |
| Departments/brands per business | 1 | 1 | 2 | 5 | 12 |
| Locations per business | 1 | 1 | 1 | 3 | 10 |
| Basic documents/customer/product/sales/expense records | yes | yes | yes | yes | yes |
| GWS link and core sales import | basic | basic | advanced verified sync | advanced verified sync | advanced verified sync |
| Saved document branding | basic | yes | yes | yes | yes |
| Reports | overview | overview | advanced | branches/team | consolidated + deeper exports |
| Recurring invoices & payment reminders | no | no | yes | yes | yes |
| Supplier/purchase workflows | no | no | basic | multi-location | multi-location |
| Staff approvals, audit dashboards | no | no | basic roles | yes | yes |

Modules/allowances above must only be marketed as **available** once verified and implemented. Sales quotas count **newly issued** documents, not drafts, previews, template experimentation, customer downloads, reprints, recovered historical receipts, void lookups, imports or quotes later converted to a paid document twice. Count at the point of final issuance, atomically and idempotently, in an Africa/Lagos calendar month. Unlimited reads and historical access regardless of plan. Clearly show current count and next reset date, with 70% / 90% notices, grace handling and upgrades. No hidden pay-per-document overage; either upgrade or optionally buy a clearly stated document pack later. Existing documents remain printable/recoverable on downgrade.

### Design profile rule

Users may browse and preview all 71 designs for free. Their tier limits *simultaneously stored document identities/styles*; they may replace an existing profile freely, without paid reset tokens or artificial cooldown. A department can use a different saved profile where the plan permits. Free plan may choose from the essential designs, and imported August designs remain grandfathered for their previous owners. Different document **types** (receipt/invoice/estimate) do not consume more profile slots. Historic issued documents keep their saved design and cannot be restyled silently.

### Global Webstores partner discount

Proposed durable incentive: **50% off Bizlano's MONTHLY LIST PRICE** for a verified GWS paid-vendor business, applied to the selected length of subscription; do not additionally stack term-duration savings or coupons with it. Example: Standard monthly ₦2,400 -> verified seller ₦1,200 monthly; Standard annual partner ₦14,400 (12 x ₦1,200) versus ordinary annual ₦23,000. Free remains free.

Require authenticated ownership link, verified ACTIVE **paid** GWS vendor subscription, and an eligible published storefront or optional service office, read from signed GWS server-to-server status, not client assertions. A mere pairing code, an expired GWS trial or a fake sale should not qualify. One discount per GWS vendor account linked to at most one eligible Bizlano tenant at a time, consistent with GWS's one account subscription (one storefront plus optional service office). Reconfirm on renewal and clear false/missing eligibility after appropriate grace. Avoid permanent unexpected midterm price increases: reprice only at renewal, with advance notice. GWS integration owner is separately in progress—coordinate, don't overwrite that work. The GWS paid subscription itself remains unchanged.

### Subscription entitlements and implementation safeguards

Use centralized plan catalogue and server-side entitlement engine; enforce limits by tenant/role before performing a write and inside a transaction where required. Do not rely on disabling buttons on the browser. Maintain `billing_accounts`, `subscriptions`, `price_versions`, `billing_cycles`, `usage_counters`, `subscription_invoices`, `payment_events`, `discount_eligibility`, `outbox_notifications` and `audit_events`, with strict tenant scoping, immutable external event IDs and processed-at idempotency keys. Never expose credentials or payment secrets in the browser.

Separate **Bizlano subscription payment** from merchants' customer sales/payout collection and GWS transactions. For recurring Paystack billing, verify signed raw-body webhooks; also verify transactions with Paystack before activating/upgrading; distinguish invoice.create, charge.success, invoice.payment_failed, subscription.disable, cancellation and refunds; protect from duplicate and out-of-order events. If Paystack subscriptions cannot natively support coupon math, create versioned eligible plans or use verified prepaid payments with clear no-auto-renew distinction. Never create an auto-renewing subscription without the business owner's explicit approval and authorization. Support manual prepaid checkout as an alternative.

Upgrades: immediate with a clear fair-value credit. Downgrades: next renewal cycle, no deletion of old data; advanced editing of over-limit departments/staff seats restricted until they reduce usage or upgrade, but existing historical data stays readable/exportable. Cancellation: opt-out of future charges, no surprises. Payment failure: transparent reminder and grace with access to historical data, reconciliation rather than automatic loss. Payment plans remain OFF until manual launch and acceptance gates are signed off.

### Notifications and calendar

Recommend **1 February 2027** as the first availability date for optional paid subscriptions (not a mandatory bill for existing Free users), subject to readiness. 30-day advance announcement on **2 January 2027**. The email should say explicitly: Free continues, payment is optional, previously issued receipts remain, payment is not auto-initiated, and premium features require a separately authorized purchase.

During December 2026: transparent pricing page and notices, optional 14-day paid-feature trials without cards. On Jan 2: in-app banner plus transactional/service announcement email to verified business owners. Follow-ups Jan 16/25/30, respecting user preferences and send limits. Avoid duplicate reminders and separate marketing opt-out from required billing notices. For actual recurring subscribers: term-aware notices (at least 30 days before quarterly/6-month/annual renewal; near due date for monthly). Every email should contain business name, plan, amount, date, renewal status and management link.

For scheduled jobs, Cloudflare Cron Triggers plus an idempotent D1 email outbox, provider retry logic and bounce monitoring; Resend free plan currently lists 100/day and 3000/month, so monitor capacity before bulk email. Do not claim notices have been sent until provider acceptance and delivery status is checked.

### Release readiness (non-negotiable)

- Correct multi-tenant authorization for owner/admin/accountant/cashier and cross-tenant calls; verify subdomain and business switcher scoping.
- Free/trial/paid/downgraded/cancelled/expired paths, caps and month reset across leap days and month boundaries; no duplicate document creation under concurrent requests.
- Design profile save/switch/replace on all plan combinations; no retroactive restyling or August MetaForge document loss.
- Document issuance and conversion preserve references and balances; invoice/receipt/payment quantities cannot be spoofed.
- GWS server-signed paid entitlement, duplicate event suppression and mapping to the correct Bizlano business; discount expiry gracefully handled.
- Paystack TEST verification, webhook forgery/replay tests, declined charges, duplicate callbacks, refunds, cancelled billing and prepayment details. Owner alone confirms final real-money test before LIVE charging.
- Emails via one dry-run test recipient, cron preview, deduped send counts, provider limits and unsubscribe routing. No unsolicited bulk live emails.
- Functional responsive QA: pricing, business switching, departmental identities, create/preview/print/save, phone/mobile, roles, errors and recoveries.
- Rollout with a manual flag `PAID_BILLING_ENABLED=false` until signed off; no production financial changes while developing. Preserve the GWS integration handled by another workstream and the live Firebase auth version.

## Capability roadmap, ordered by business value

**First (before paid launch):** proper document lifecycle, curated business dashboard, receipt design profiles and original migration, tenant-safe staff/brand scoping, transparent plans and quota meter, Paystack billing + cancellation + renewal, GWS active-vendor status discount verification, automated notices, audit/event visibility, 30-day in-app announcement.

**Second (first post-launch releases):** recurring invoices and reminders, supplier and purchase orders, stock restocking, branch transfers, sales-and-expenses profitability, data exports/permissions, customer quote acceptance, service job estimate/deposit progress, barcode-assisted checkout on compatible devices.

**Later (only with justified usage):** limited offline POS sync (complex reconciliation), payroll/HR, automated bank reconciliation, advanced tax/e-invoicing integrations (must verify Nigeria Revenue Service requirements and provider approval), AI-generated business summaries/forecasting, more external ecommerce connections. Do not promise tax certification or universal Bluetooth printer pairing unless genuinely certified/verified.

## Research references (verified Nov 2026)

- Bumpa plans: https://www.getbumpa.com/pricing
- Zoho Books Nigeria: https://www.zoho.com/en-ng/books/pricing/
- Loyverse: https://loyverse.com/pricing
- Paystack subscriptions: https://paystack.com/docs/payments/subscriptions/
- Paystack webhooks: https://paystack.com/docs/payments/webhooks/
- Cloudflare Cron: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Resend pricing: https://resend.com/pricing?product=transactional
- NRS e-invoicing: https://einvoice.nrs.gov.ng/
