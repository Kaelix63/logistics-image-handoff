import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { infrai } from "./infrai.ts";

export const shipmentSchema = z.object({
  shipmentId: z.string().min(1),
  event: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  imageKey: z.string().min(1),
  contentType: z.string().default("image/jpeg")
});

export function nextShipmentState(event: string): "delivered" | "attention" | "moving" {
  if (event === "delivered") return "delivered";
  if (event === "exception") return "attention";
  return "moving";
}

export async function createProofHandoff(input: unknown) {
  const shipment = shipmentSchema.parse(input);
  const bucket = `logistics-proof-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await infrai.storage.bucket.create({ name: bucket });
  const signed = await infrai.storage.object.presign(bucket, shipment.imageKey, { op: "put", expires_seconds: 900, content_type: shipment.contentType, idempotency_key: shipment.shipmentId });
  const resize = await infrai.image.resize({ image: signed.url, width: 1600, height: 1200, fit: "inside", enlarge: false, format: "webp", store: true });
  return { shipmentId: shipment.shipmentId, state: nextShipmentState(shipment.event), bucket, uploadUrl: signed.url, resize };
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/shipments/proof") { response.writeHead(404); response.end(); return; }
  try {
    const body = await new Promise<string>((resolve, reject) => { let raw = ""; request.on("data", (chunk) => { raw += chunk; }); request.on("end", () => resolve(raw)); request.on("error", reject); });
    const result = await createProofHandoff(JSON.parse(body));
    response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify(result));
  } catch (error) { response.writeHead(400, { "content-type": "application/json" }); response.end(JSON.stringify({ error: (error as Error).message })); }
});

if (process.env.RUN_SERVICE === "1") server.listen(Number(process.env.PORT ?? 3000));
