# Bizlano Cloudflare deployment

This is the live Cloudflare Worker hosting Bizlano with D1 for tenant records, immutable financial documents, Firebase-verified identity bridging, and private R2 logo storage.

**Production Worker:** `bizlano` in the **timilehintallest@gmail.com** Cloudflare account, never the GWS account. Database: `bizlano-db`. R2: `bizlano-assets`. Cloudflare account ID is included in deployment records, not browser-visible configuration.

The Worker frontend is a self-contained, mobile-first JavaScript client. The repository also has the new React/TypeScript suite at `business-react/`, which has not yet been substituted for this served frontend. Do not claim the Worker is deploying compiled React.

This source can be reproduced using `cd platform/worker && node build.mjs` and `wrangler deploy` after authenticating the dedicated Cloudflare account. Do not run GitHub Actions or publish any Firebase service-account secret.

Legacy MetaForge users can sign in using their existing Firebase email/password, then verify their email. Backend access requires a verified Firebase ID token validated on the Worker with Google's public signing keys. New records are isolated per tenant in D1. Old Firebase receipt data stays in Firebase until each user explicitly chooses a migration; it is not implicitly imported to D1.

The current workers.dev hostname is an interim public URL. Individual business subdomains require a verified, user-owned brand domain and wildcard routing; a slug reserved in D1 is not DNS.

## Public Bizlano website and real brand assets

- `/` is the new polished, mobile-first **public marketing website**, with feature explanations, a responsive dashboard illustration, sample receipt and working FAQs. It uses `landing.html`, not the login-first private dashboard.
- `/app` is the Firebase-authenticated business workspace; `/join?token=...` accepts invited verified staff using the existing sign-in experience.
- The **actual generated Bizlano wordmark and extracted monogram** live in the repository under `assets/bizlano-logo.png` and `assets/bizlano-mark.png`; a compressed illustrative hero image is in `assets/bizlano-hero.jpg`.
- The same assets are currently in `bizlano-assets` R2 at `brand/bizlano-logo.png`, `brand/bizlano-mark.png` and `brand/bizlano-hero.jpg`. The Worker serves only those public keys as `/assets/bizlano-*.png` and `/assets/bizlano-hero.jpg`.
- The favicon, app header, marketing header and receipt footer use consistent Bizlano branding. Real product receipts carry **Powered by Bizlano**.
- The GitHub asset files ensure recovery if R2 is ever accidentally cleared. They must be re-uploaded under the keys above before deploying into an empty R2 bucket. R2 is **not publicly exposed** as a bucket.
- `build.mjs` bundles `landing.html`, `index.html`, `client.js` and the Worker into `dist/worker.js`; it runs using Node without paid build services.

**Verified 11 November 2026:** The public homepage, business sign-in page, brand favicon/images, correct CTA routes and Worker D1 health were checked on the live hostname. A browser walkthrough confirmed working desktop navigation and FAQs, with no visible desktop overlap. Anonymous requests to `/api/me` and unrelated tenant document endpoints returned HTTP 401. Landing and worker source regression tests passed. A physical mobile browser/390px screenshot and a verified owner/staff sign-in test remain necessary.

**Do not confuse these:** The public landing site is fully served by the Worker, but the standalone `business-react/` TypeScript project has **not** replaced the JavaScript workspace yet. The latter is the app actually running behind `/app` and D1. Cloudflare automatic GitHub Builds are also not enabled; deployment is still manual Cloudflare Worker upload, with no GitHub Actions.

## Customer receipt recovery (live)

**Public entry:** https://bizlano.pages.dev/receipts . The marketing homepage links directly to it. Customers never need to create a business, select a tenant, or sign in on a business subdomain.

- First time: register with the **same email used on receipts**, then verify ownership of that email with the Firebase link. Returning customers sign in with that email/password.
- The session uses the existing verified Firebase ID token and Bizlano secure HTTP-only cookie, but does not create a tenant or assign a staff role.
- Private `GET /api/customer/receipts` looks up paid or partially paid documents by the email **snapshotted when the business issued the receipt**, across all tenants. It also includes documents the signed-in customer has claimed with a valid recovery code.
- Private history is loaded in pages of 50 using an index-compatible cursor. The customer can search within their own loaded documents and request more results.
- Private `GET /api/customer/receipts/<id>` repeats the exact ownership filter before returning detailed line items. Public search by customer name, phone, product, or order ID is **not allowed**.
- Every new paid receipt created manually or via a verified Global Webstores order receives an unguessable recovery code generated by a Worker-only HMAC secret; only the SHA-256 digest is stored in D1. The code appears on printable business receipts.
- A customer already signed in with a verified email can claim an older receipt using its recovery code. `/api/customer/claim` has an authenticated rate limit of 8 attempts per rolling 15-minute window. Rejected, revoked, and invalid codes reveal no customer details.
- An old record with neither a recorded customer email nor a valid recovery code **cannot be matched automatically**. A business must verify the customer and provide a recovery code. Never link purchases based on matching names.
- Receipt PDF downloads use the browser's **Print / Save as PDF** flow and are free. There is not yet a server-generated PDF file or automatic email delivery.

### Business-domain routing

`/s/<slug>` is the fallback public landing for a business. It is **customer-first**, with **Recover your receipt** linking to `https://bizlano.pages.dev/receipts?business=<slug>` and a separate private link for authorized staff at `/app?biz=<slug>`. Both return to the centralized site, not a business subdomain.

When a custom domain is purchased, configure Cloudflare DNS/TLS and wildcard routes, and set `BIZLANO_PUBLIC_ORIGIN` on the Worker to the approved HTTPS canonical origin. The **same stable tenant ID and D1 records** continue to serve every business; data is never copied or migrated just to change URLs. Buying a domain alone cannot automatically provision Cloudflare DNS or certificates.

### Verification status

- D1 migrations `0005_customer_receipt_recovery.sql` and `0006_verified_customer_inbox.sql` are applied on the dedicated Bizlano database.
- Public portal, customer sign-in/register toggle, branded layout and navigation passed read-only browser QA; the homepage and secure API routes were smoke-tested live.
- Verified-email cross-business data retrieval and receipt claims have source-level regression tests and D1 query compilation checks, **but need a signed-in end-to-end test with an actual paid transaction before claiming they are fully certified**.
- The GWS connection requires both applications to share a securely configured server-to-server secret and successfully deployed webhook integration before automatic receipts operate on live payments. Never treat unverified tests as paid purchases.

## Runbook

1. Test `/api/health` returns a live D1 connection.
2. Confirm unauthenticated `/api/me` and all tenant endpoints deny access.
3. Test registration, email verification, tenant creation, staff invite/join, product stock, invoice issuance, partial settlement, PDF printing, logo upload and tenant isolation using real owner/staff test accounts.
4. Test Firebase legacy identity linking, migration archive availability and original links separately.
5. Back up D1 and maintain the original Firebase app before any DNS or identity migration.
6. Set up automatic build and deployment only after Cloudflare's GitHub build token authorization is approved. This repository uses no GitHub Actions.
