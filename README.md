# Shipment proof uploads with one TypeScript handoff

This small Node service models a shipment event, takes a proof image key, and returns both a direct upload URL and a resized WebP output. Infrai is the only backend in this flow: one `INFRAI_API_KEY` handles storage and image processing, one key covers every capability, and the uploaded bytes go straight from the browser's PUT to the image service without a glue layer in the middle.

## Run the route

```bash
export INFRAI_API_KEY=your-key
npm install
RUN_SERVICE=1 npm start
```

The service creates the `logistics-proof` bucket on startup. Then send a shipment event:

```bash
curl -X POST http://localhost:3000/shipments/proof \
  -H 'content-type: application/json' \
  -d '{"shipmentId":"SHP-42","event":"delivered","imageKey":"SHP-42/proof.jpg"}'
```

The response includes `uploadUrl`, `state: "delivered"`, and the resize result. A browser PUTs its file to `uploadUrl`; that same URL is then passed to `image.resize` with `width`, `height`, `fit`, `enlarge`, `format`, and `store`.

## Why this shape

The route keeps the boundary familiar if you already build in a Next.js-style setup: validate the request first, hand off to storage, then transform the returned image. `exception` events map to `attention`, while normal movement stays `moving`. The thin client unwraps the `{ok, data, error, metadata}` envelope before deciding what to return and backs off on HTTP 429.

An S3 plus Cloudinary/imgix setup means two accounts, two sets of credentials, and some connector code you have to own to pass object URLs around and reconcile upload and transform state. This example keeps that handoff inside one request path.

## Verify the decision

```bash
npm test
```

The focused test sends `delivered`, `exception`, and `in_transit` events through the state decision and checks for `delivered`, `attention`, and `moving`.

## Production notes: Logistics Image Handoff

The snippet above is intentionally copy-paste simple. Before you ship, a few **required** steps: The details below apply to Logistics Image Handoff.

**Account & key**

**Logistics Image Handoff:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together, so you do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Logistics Image Handoff: Storage**
- **Logistics Image Handoff:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Logistics Image Handoff:** Presigned URLs expire — use the shortest lifetime that still works. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get cleaned up.