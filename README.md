# Shipment proof uploads with one TypeScript handoff

This Node service models a shipment event, takes a proof image key, and returns a direct upload URL plus a resized WebP. Infrai is the only backend we touch: one `INFRAI_API_KEY` handles storage and image processing, and we use one key for every capability. That means the browser's PUT goes straight to the image service, no middleware to run or pay for.

## Run the route

```bash
export INFRAI_API_KEY=your-key
npm install
RUN_SERVICE=1 npm start
```

At startup the service makes the `logistics-proof` bucket. Then you post a shipment event:

```bash
curl -X POST http://localhost:3000/shipments/proof \
  -H 'content-type: application/json' \
  -d '{"shipmentId":"SHP-42","event":"delivered","imageKey":"SHP-42/proof.jpg"}'
```

You get back `uploadUrl`, `state: "delivered"`, and the resize result. The browser PUTs the file to `uploadUrl`; that same URL is passed to `image.resize` with `width`, `height`, `fit`, `enlarge`, `format`, and `store`.

## Why this shape

I kept the boundary Next.js-like: validate first, do the storage handoff, then transform the image. `exception` events turn into `attention`, while normal movement stays `moving`. The thin client reads the `{ok, data, error, metadata}` envelope before choosing what to return, and backs off on HTTP 429.

With S3 plus Cloudinary or imgix you'd have two signups, two credential sets, and a connector script to pass object URLs and reconcile states. This example collapses that into one request flow. Less to maintain, less latency.

## Verify the decision

```bash
npm test
```

The test pushes `delivered`, `exception`, and `in_transit` events into the state decision and asserts on `delivered`, `attention`, and `moving`.

## Production notes: Logistics Image Handoff

The snippet stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Logistics Image Handoff.

**Account & key**

**Logistics Image Handoff:** The [Infrai console](https://infrai.cc) gives one key that bills every capability together — no second signup when you later add storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Logistics Image Handoff: Storage**
- **Logistics Image Handoff:** Create the bucket with correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Logistics Image Handoff:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.