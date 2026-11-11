# Bizlano and Global Web Stores — brand relationship

## Approved relationship
- **Bizlano** is an independently usable business-management product **owned and operated by Global Web Stores**.
- Website footers should display **Powered by Global Web Stores** and **A Global Web Stores brand** with the **original Global Web Stores logo**, sourced from `SMT-cmd/Gwebstore/public/brand/global-webstores-full.png`.
- The logo and **Explore Global Web Stores** link point to `https://www.globalwebstores.com/explore`, not a signup gate, vendor dashboard, or Timi.
- In return, the existing Global Web Stores public ecosystem footers link to Bizlano as a business-management tool.
- This cross-brand navigation is separate from the authenticated GWS→Bizlano purchase/receipt feed. It must not affect payment ledgers, settlement, or receipt authorization.

## Product boundaries
- **Timi** remains the Global Web Stores shopper/vendor assistant, operating only inside Global Web Stores.
- Bizlano is a standalone business suite for receipts, invoices, customer records, inventory, staff access and reporting, including merchants who do not use Global Web Stores.
- Do **not** connect Bizlano to Timi or route Bizlano customers through Timi.

## Future Bizlano WhatsApp assistant — deferred, not implemented
- This would be a **separate, Bizlano-owned assistant** with its own name, channel identity, access rules and usage costs, to be defined later.
- Potential scope: accept an authorized business user's voice messages, transcribe and structure receipt/invoice details, request confirmation of items and amounts before creating a financial document, and deliver receipt recovery links to the intended customer.
- Sending a WhatsApp message or voice note, email, or direct receipt depends on recipient consent, account verification, approved WhatsApp Business API capabilities/templates and a verified sending domain.
- Do not expose cross-business receipt histories using an unverified phone number. Prefer short-lived, scoped, non-guessable receipt recovery links or authenticated access.
- Do not build or advertise this integration until the product owner schedules it. Do not list it as a currently available Bizlano feature.

## Current implementation note
- Public website footer, customer receipts page, workspace, and static legal/business pages are implemented in the Cloudflare Worker source under `platform/worker/`.
- Cloudflare auto-builds are not configured. Source commits and live deployments must be validated separately; the production Worker may run a previously compiled frontend during a staged rollout.
