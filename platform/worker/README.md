# Bizlano Cloudflare deployment

This is the live Cloudflare Worker hosting Bizlano with D1 for tenant records, immutable financial documents, Firebase-verified identity bridging, and private R2 logo storage.

**Production Worker:** `bizlano` in the **timilehintallest@gmail.com** Cloudflare account, never the GWS account. Database: `bizlano-db`. R2: `bizlano-assets`. Cloudflare account ID is included in deployment records, not browser-visible configuration.

The Worker frontend is a self-contained, mobile-first JavaScript client. The repository also has the new React/TypeScript suite at `business-react/`, which has not yet been substituted for this served frontend. Do not claim the Worker is deploying compiled React.

This source can be reproduced using `cd platform/worker && node build.mjs` and `wrangler deploy` after authenticating the dedicated Cloudflare account. Do not run GitHub Actions or publish any Firebase service-account secret.

Legacy MetaForge users can sign in using their existing Firebase email/password, then verify their email. Backend access requires a verified Firebase ID token validated on the Worker with Google's public signing keys. New records are isolated per tenant in D1. Old Firebase receipt data stays in Firebase until each user explicitly chooses a migration; it is not implicitly imported to D1.

The current workers.dev hostname is an interim public URL. Individual business subdomains require a verified, user-owned brand domain and wildcard routing; a slug reserved in D1 is not DNS.

## Runbook

1. Test `/api/health` returns a live D1 connection.
2. Confirm unauthenticated `/api/me` and all tenant endpoints deny access.
3. Test registration, email verification, tenant creation, staff invite/join, product stock, invoice issuance, partial settlement, PDF printing, logo upload and tenant isolation using real owner/staff test accounts.
4. Test Firebase legacy identity linking, migration archive availability and original links separately.
5. Back up D1 and maintain the original Firebase app before any DNS or identity migration.
6. Set up automatic build and deployment only after Cloudflare's GitHub build token authorization is approved. This repository uses no GitHub Actions.
