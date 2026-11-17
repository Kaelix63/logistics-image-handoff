import { nextShipmentState } from "../src/logistics_service.ts";

const cases: Array<[string, string]> = [["delivered", "delivered"], ["exception", "attention"], ["in_transit", "moving"]];
for (const [event, expected] of cases) {
  if (nextShipmentState(event) !== expected) throw new Error(`${event} state mismatch`);
}
console.log("shipment state decisions pass");
