# Original MetaForge designs and Bizlano document-studio migration

## Source-of-truth historical version

The original MetaForge document engine was recovered from commit `75c2c4b` (August 19, 2026) in `SMT-cmd/META-RECEIPT-ENGINE`, specifically `creator/index.html` (the named gallery) and `engine/index.html` (the actual print layout/CSS). The 35 original template IDs and their display names are recorded in `platform/worker/legacy-templates-map.json`; original rules are retained in `platform/worker/heritage-source.css`. The production application scopes these historical rules to the new receipt markup in `platform/worker/index.html`, preserving vertical Japanese branding and Swiss full-height sidebar rather than only changing accents.

The original 35 are **additive** to the 36 preexisting Bizlano templates, resulting in **71 choices**. Legacy templates are namespaced as `heritage-<original-template-id>`; existing Bizlano IDs are never changed or overwritten.

## Owner flow

1. Select business type.
2. Choose from suggested original and current templates, with a swipeable layout gallery and full-size previews; search the complete list of 71.
3. Personalise the template with primary colour, secondary colour, font, text-logo style, and optional uploaded image logo/signature.
4. Review the actual printable output and save.

There is no template persistence before stage 4. The saved template, both colours and typography are tenant-scoped, and the original document list and data are unchanged.

## Existing users and legacy migration

The verified Firebase owner may scan their previous `short_urls` records by `owner_uid`. MetaForge saved its compressed receipt branding configuration in `config` on each engine record. Bizlano decodes only known legacy template names, safe hexadecimal colours, and a supported font mapping. The owner can stage a matched design in the same wizard, review its appearance and save it to their Bizlano business. This does not copy another user's document or automatically overwrite a current design. Existing downloadable legacy archives retain `config` when available.

The migration of old receipt history remains a separate, explicit review-only operation. A former template can be restored even if there is no receipt to import. Existing business data, issued receipt IDs and customer records are not changed by template discovery.

## Data schema

`0011_heritage_receipt_designs.sql` **adds only** `secondary_color`, `font_family` and `text_logo_style` to `tenant_designs`. It does not drop or rewrite rows. Existing values receive defaults. New backend writes validate all IDs and field values.

## Verification

Run `node --test tests/bizlano-heritage-71.test.js tests/bizlano-guided-workflows.test.js`, the complete Node test suite, and manual browser verification at mobile and desktop widths. Compare the actual original Japanese, Swiss, Garage Workshop and Construction documents at print size. Final financial issuance must remain under the business owner's control.

Keep the current Firebase-compatible production authentication until a separate, fully tested authentication migration is approved. This template change is not a reason to replace login providers.

