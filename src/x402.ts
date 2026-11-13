import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPRequestContext,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddlewareFromHTTPServer } from "@x402/hono";
import type { MiddlewareHandler } from "hono";
import { CONFIG, toAtomicAmount } from "./config.js";
import { getVenueById } from "./db.js";

export const facilitatorClient = new HTTPFacilitatorClient({
  url: CONFIG.facilitatorUrl,
  timeoutMs: 15000,
});

export const x402Server = new x402ResourceServer(facilitatorClient).register(
  CONFIG.chain.network,
  new ExactEvmScheme(),
);

function buildPriceObject(usdAmount: number) {
  return {
    asset: CONFIG.chain.asset,
    amount: toAtomicAmount(usdAmount, CONFIG.chain.decimals),
    extra: {
      name: CONFIG.chain.name,
      version: CONFIG.chain.version,
    },
  };
}

async function resolveReservePrice(ctx: HTTPRequestContext) {
  let venueId = "";
  const queryId = ctx.adapter.getQueryParam?.("venueId");
  if (typeof queryId === "string") venueId = queryId;
  if (!venueId && ctx.adapter.getBody) {
    try {
      const body = (await ctx.adapter.getBody()) as Record<string, unknown> | null;
      if (body && typeof body.venueId === "string") venueId = body.venueId;
    } catch {
      // keep default deposit price
    }
  }
  const venue = venueId ? getVenueById(venueId) : undefined;
  // Use real venue USD price if found and available, else $0.05 protocol test deposit
  const usd = venue && venue.status === "available" ? venue.price_usd : 0.05;
  return buildPriceObject(usd);
}

export const httpResourceServer = new x402HTTPResourceServer(x402Server, {
  "GET /api/x402/quote": {
    accepts: {
      scheme: "exact",
      price: buildPriceObject(0.05),
      network: CONFIG.chain.network,
      payTo: CONFIG.payTo,
      maxTimeoutSeconds: 300,
    },
    description: "Balian Kite Concierge — Verified Bali Venue Quote & Sunset Telemetry ($0.05 USDC.e)",
    mimeType: "application/json",
  },
  "POST /api/x402/reserve": {
    accepts: {
      scheme: "exact",
      price: resolveReservePrice,
      network: CONFIG.chain.network,
      payTo: CONFIG.payTo,
      maxTimeoutSeconds: 300,
    },
    description: "Balian Kite Concierge — Atomic Hospitality Booking & Consumable Credit Lock (x402)",
    mimeType: "application/json",
  },
});

// Sync with Pieverse facilitator on first request (or pre-warm on boot)
export const x402Middleware: MiddlewareHandler = paymentMiddlewareFromHTTPServer(
  httpResourceServer,
  undefined,
  undefined,
  true,
);
