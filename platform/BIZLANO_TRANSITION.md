# Bizlano product transition (working name chosen 2026-11-10)

Bizlano replaces the **new React/TypeScript business suite** brand: *Your business, beautifully managed.* The original MetaForge creator, public receipts and historical Firebase identities are not renamed, deleted or redirected by this change.

## This source change

- React suite title, vector favicon, navigation, document footer and export filenames are branded Bizlano.
- Existing MetaForge receipts still display where they originated; imported records remain drafts for review.
- Invitation and business links without a configured domain now point to **the current React route**, not the older, unrelated browser-local `/business/` workspace.
- The client and rules reject voiding issued documents with recorded payments or lowering previously recorded paid amounts through an ordinary edit. Actual refunds must use a separate audited accounting flow.
- No subscriptions or payment gates have been added.

## Cloudflare release status — 11 November 2026

**Live interim URL:** https://bizlano.praylume-staging-ng.workers.dev/

- The dedicated Cloudflare account `timilehintallest@gmail.com` now hosts Worker `bizlano`, D1 database `bizlano-db`, and R2 bucket `bizlano-assets`. These are separate from all Global Webstores resources.
- The Worker serves a mobile-first JavaScript frontend connected directly to its D1/R2 API, while authenticating existing Firebase users with validated ID tokens. This is a real deployed app, **not yet the built React/TypeScript suite**.
- D1 migration versions 0001–0003 have been applied to the dedicated Bizlano database. A separate throwaway QA database passed invoice stock, draft issue/void, partial payment and rejection tests; it was deleted after testing.
- The website and /api/health were checked live; unauthorized API requests were checked to return HTTP 401. Full owner/staff journeys and import still require authenticated browser tests.
- Owner-triggered legacy scan, private backup and idempotent D1 draft imports are implemented. They are **opt-in**, never overwrite existing Firebase receipts, and never mark imported entries as paid sales.
- The app supports responsive bottom navigation, live business totals and trend charts, branded document output with **Powered by Bizlano**, and R2 logo uploads.
- The Cloudflare connection now references the GitHub repository, but **automatic Cloudflare Builds deployment is not configured**; changes were deployed through the Cloudflare API. No GitHub Actions were used.
- Custom company wildcard subdomains are **not live**. They need a brand domain you own, a wildcard DNS/Worker route, and TLS verification. D1 slug allocation alone is not DNS.

The legacy site and prior Firebase accounts remain intact.

## React/TypeScript release still pending

The `/business-react/` directory is Vite source, **not** a proven built/deployed production app. Firebase Hosting still serves the original MetaForge site; the new logo is not used on legacy receipt pages. This change does not assert that new subdomains resolve, DNS is connected, email is configured, or Firestore rules are deployed.

Before release: run `npm install && npm run build` within `business-react`, run `node --test tests/*.test.js` from repository root, exercise Firestore rules with the emulator, and conduct real owner/staff invite, payment and migration tests. The chosen domain and trademarks still need verification. Deploy no identity migration or URL redirection without a tested fallback and complete export.
