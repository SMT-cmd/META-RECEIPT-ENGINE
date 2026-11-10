# Bizlano product transition (working name chosen 2026-11-10)

Bizlano replaces the **new React/TypeScript business suite** brand: *Your business, beautifully managed.* The original MetaForge creator, public receipts and historical Firebase identities are not renamed, deleted or redirected by this change.

## This source change

- React suite title, vector favicon, navigation, document footer and export filenames are branded Bizlano.
- Existing MetaForge receipts still display where they originated; imported records remain drafts for review.
- Invitation and business links without a configured domain now point to **the current React route**, not the older, unrelated browser-local `/business/` workspace.
- The client and rules reject voiding issued documents with recorded payments or lowering previously recorded paid amounts through an ordinary edit. Actual refunds must use a separate audited accounting flow.
- No subscriptions or payment gates have been added.

## Not yet released

The `/business-react/` directory is Vite source, **not** a proven built/deployed production app. Firebase Hosting still serves the original MetaForge site; the new logo is not used on legacy receipt pages. This change does not assert that new subdomains resolve, DNS is connected, email is configured, or Firestore rules are deployed.

Before release: run `npm install && npm run build` within `business-react`, run `node --test tests/*.test.js` from repository root, exercise Firestore rules with the emulator, and conduct real owner/staff invite, payment and migration tests. The chosen domain and trademarks still need verification. Deploy no identity migration or URL redirection without a tested fallback and complete export.
