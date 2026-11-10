# MetaForge to rebranded business platform: safe rollout guide

Status: implementation in progress. Do not deploy to Cloudflare or retire the legacy engine until release checks pass.

## Verified source

- Legacy MetaForge uses Firebase Auth + Firestore (metaforge-6afdf), not an active Supabase integration.
- A separate Supabase project called Metaaforge was found, but it is inactive and its tables were inaccessible. Do not assume it contains or lacks legacy data.
- The separate Cloudflare account is connected as timilehintallest@gmail.com, distinct from the account holding gws-tenant-router and globalwebstores.com.
- Legacy generated receipt URLs and user settings depend on existing Firebase records. Preserve them.

## Existing components

- /creator/ and /engine/ remain available except for a non-blocking upgrade notice shown on sign-in.
- /upgrade/ offers existing-account sign-in, read-only scans, coverage warnings, JSON download and optional review-only draft staging. Device histories require explicit consent.
- /business/ is a browser-local workspace, NOT a synchronized cloud tenant destination.
- /business-react/ is the typed React/Firebase workspace source: tenant directory, invitation roles, isolated collections, previews, charts and shared targets. Its production build and live end-to-end flow still require verification.
- /platform/migrations/ contains proposed Cloudflare D1 schema, NOT a deployed database.

## Legacy user journey

1. Existing user signs in through the same Firebase account.
2. A dismissible Review my upgrade prompt offers review or Later. The old creator remains usable.
3. The upgrade page reads short-link records explicitly owned by the signed-in Firebase UID. It never treats browser-only histories as verified ownership.
4. The user sees how many histories could not be read, then downloads a personal backup.
5. Records with reliable item details can be copied as REVIEW-ONLY DRAFTS, never silently counted as new sales. Raw data remains in the archive.
6. The old links, old login and source records are never deleted.
7. When Cloudflare deployment is ready, obtain consent again to upload the archive or verify the original Firebase identity and map it to the new user account.

## Future Cloudflare design

- React + TypeScript on Workers Static Assets, with a tenant-aware Worker API.
- D1 for memberships, documents, ledger, inventory, expenses, business-wide targets and audit history; minor-unit amounts for money.
- R2 private objects for business files and optional customer-consented backups.
- Durable Objects for real-time chat, with membership checks at every entrypoint.
- Wildcard domain route for business slugs only AFTER a new platform domain is acquired and configured. A subdomain is a routing address, never proof of tenant authorization.
- No subscriptions until core user journeys and migration are validated.
- Only the non-Global-Webstores Cloudflare account may be used.

## Account bridge

Retain old passwords in Firebase; do NOT export or attempt to recreate them. A future API must verify a Firebase ID token using provider signing keys, and validate issuer, audience, expiry and UID before linking to a new account. A claimed email address or UID alone is not proof. The D1 legacy-identity migration is designed for idempotent import tracking and safe retries. Raw receipt exports require restricted upload permissions and must never be logged.

## Notifications

Use in-app notices now. No Resend email should be sent until the new sending domain has been acquired and verified. Users do not need to own a company email address to sign in to their legacy MetaForge account.

## Manual release checks (no GitHub Actions)

- Run Node tests locally: node --test tests/business-core.test.js tests/legacy-migration.test.js tests/business-insights.test.js tests/staff-roles.test.js tests/site-integrity.test.js tests/shortener.test.js
- Install React dependencies and execute npm run build inside business-react.
- Exercise Firebase rules with owner, manager, accountant, cashier, sales, suspended user, viewer and nonmember from another business.
- Verify the complete receipt issue, partial payment, stock, void, backup, reopen and export journey in a browser.
- Verify one legacy user with actual short links and local histories. Test inaccessible receipts, corrupt data, large archive and repeated imports.
- Validate all original short links before and after cutover.
- Test newly authorized Firebase domains before switching hostnames.
- Confirm charts exclude drafts and voided records and targets are private to each business.
- Do not claim a source commit has deployed the web app.
- Pick and verify a short replacement brand and domain before changing public URLs.
- Do not enable Cloudflare routing or delete the legacy database automatically.
