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

## Runbook

1. Test `/api/health` returns a live D1 connection.
2. Confirm unauthenticated `/api/me` and all tenant endpoints deny access.
3. Test registration, email verification, tenant creation, staff invite/join, product stock, invoice issuance, partial settlement, PDF printing, logo upload and tenant isolation using real owner/staff test accounts.
4. Test Firebase legacy identity linking, migration archive availability and original links separately.
5. Back up D1 and maintain the original Firebase app before any DNS or identity migration.
6. Set up automatic build and deployment only after Cloudflare's GitHub build token authorization is approved. This repository uses no GitHub Actions.
