# Global Webstores → Bizlano business feed (v2)
Status: receiving contract implemented in Bizlano source; production end-to-end activation NOT yet verified. Coordinate sender work in SMT-cmd/Gwebstore without overwriting simultaneous changes.

## Endpoint and signature
`POST https://<bizlano-host>/api/integrations/gws/event`
Sender: Global Webstores server only, never a browser.
Headers: `content-type: application/json`, `x-bizlano-timestamp: <Unix seconds>`, `x-bizlano-signature: <64-digit hex>`.
Sign the **exact request JSON bytes** with HMAC-SHA256 using a strong per-connector shared secret: `HMAC(secret, timestamp+"."+rawBody)`. Receiver rejects timestamps older/newer than 5 minutes, invalid signatures, oversized bodies, unconnected vendors and invalid payloads.
The Bizlano Worker secret is `GWS_BRIDGE_SECRET`; the GWS Vercel variable is `BIZLANO_GWS_SHARED_SECRET`. Do not put the secret in GitHub, frontend JS or logs.

## Events
All events include a verified GWS vendor ID; **non-receipt events must also include an eventId** (unique stable ID, 8–150 URL-safe characters), and `type`. Never reuse eventId for different payload bytes.

- `order.paid` — existing GWS shape: `{vendorId,type,order:{id,currency:"NGN",status,legacyTestRecord,quantity,totalMinor,deliveryMinor,handlingMinor,processingMinor,productTitle,customerName,customerEmail,customerPhone,paymentReference}}`. GWS validates real settled payment before this call. Exactly one Bizlano receipt and payment record per order ID.
- `catalog.product.upsert` — `{vendorId,eventId,type,product:{id,name,sku?,priceMinor,stockMilli?}}`. Bizlano keeps a marketplace snapshot, **not** a direct change to merchant-controlled inventory.
- `catalog.product.deleted` — `{vendorId,eventId,type,product:{id}}`. Marks a marketplace snapshot inactive.
- `order.status.updated` — `{vendorId,eventId,type,order:{id,status,trackingReference?}}`; permitted states: PAID_ESCROW_HELD, BOOKED_FOR_DELIVERY, IN_TRANSIT, DELIVERED, CONFIRMED, COMPLETED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED, RETURNED, DISPUTED.
- `order.refunded` — `{vendorId,eventId,type,refund:{id,orderId,currency:"NGN",amountMinor,reason?}}`. Records signed refund for reconciliation. Does **not** mutate an issued receipt.
- `payout.settled` — `{vendorId,eventId,type,settlement:{id,orderId,currency:"NGN",amountMinor,reference?}}`. Records settlement; does **not** record an additional buyer payment.

## Link lifecycle
`/status`, `/connect`, `/disconnect` remain signed and unchanged. Bizlano owner creates a 30-minute one-use linking code; GWS redeems it. No customer password or merchant password crosses the bridge.
`status` returns `contractVersion:2` and `supportedEvents`. Never send events for unconnected vendors. On disconnect, preserve prior audit history.

## Acceptance before calling it live
1. Verify matching secret is installed **only** in intended Bizlano Worker and GWS production environment. Recheck after any secret rotation.
2. Run a genuine vendor link, status and disconnect with no cross-vendor exposure.
3. Replay the same eventId: second response must say alreadyRecorded without duplicate rows. Reusing an eventId with different data must fail.
4. Test invalid signature, stale timestamp, missing contact and test orders. They must not create financial documents.
5. For one verified paid order, confirm exactly one receipt and payment, correct customer/handling/shipping amounts, recoverable receipt, and vendor notice.
6. Send product, fulfilment, refund and payout events; confirm Bizlano shows their snapshots and that merchant stock and issued receipts are unchanged.
7. Test out-of-order event delivery and reconcile missed webhook events. GWS should enqueue/retry failed deliveries rather than only logging.
8. Validate both production deployments and record commit evidence for the two independent services.

Never claim end-to-end sync merely because source code or DB tables exist.
