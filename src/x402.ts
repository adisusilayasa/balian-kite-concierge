import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPRequestContext,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddlewareFromHTTPServer } from "@x402/hono";
import type { MiddlewareHandler } from "hono";
import { CONFIG, KITE_NETWORKS, toAtomicAmount, type KiteNetworkInfo } from "./config.js";
import { getVenueById } from "./db.js";

export const facilitatorClient = new HTTPFacilitatorClient({
  url: CONFIG.facilitatorUrl,
  timeoutMs: 15000,
});

// Register BOTH Kite Mainnet (eip155:2366 USDC.e) and Kite Testnet (eip155:2368 pieUSD)
export const x402Server = new x402ResourceServer(facilitatorClient)
  .register(KITE_NETWORKS.mainnet.network, new ExactEvmScheme())
  .register(KITE_NETWORKS.testnet.network, new ExactEvmScheme());

function buildPriceObject(usdAmount: number, chain: KiteNetworkInfo) {
  return {
    asset: chain.asset,
    amount: toAtomicAmount(usdAmount, chain.decimals),
    extra: {
      name: chain.name,
      version: chain.version,
    },
  };
}

async function resolveVenueUsd(ctx: HTTPRequestContext): Promise<number> {
  let venueId = "";
  const queryId = ctx.adapter.getQueryParam?.("venueId");
  if (typeof queryId === "string") venueId = queryId;
  if (!venueId && ctx.adapter.getBody) {
    try {
      const body = (await ctx.adapter.getBody()) as Record<string, unknown> | null;
      if (body && typeof body.venueId === "string") venueId = body.venueId;
    } catch {
      // fallback default
    }
  }
  const venue = venueId ? getVenueById(venueId) : undefined;
  return venue && venue.status === "available" ? venue.price_usd : 0.05;
}

export const httpResourceServer = new x402HTTPResourceServer(x402Server, {
  "GET /api/x402/quote": {
    accepts: [
      {
        scheme: "exact",
        price: buildPriceObject(0.05, KITE_NETWORKS.mainnet),
        network: KITE_NETWORKS.mainnet.network,
        payTo: CONFIG.payTo,
        maxTimeoutSeconds: 300,
      },
      {
        scheme: "exact",
        price: buildPriceObject(0.05, KITE_NETWORKS.testnet),
        network: KITE_NETWORKS.testnet.network,
        payTo: CONFIG.payTo,
        maxTimeoutSeconds: 300,
      },
    ],
    description: "Balian Kite Concierge: Verified Bali Venue Quote and Sunset Telemetry ($0.05)",
    mimeType: "application/json",
  },
  "POST /api/x402/reserve": {
    accepts: [
      {
        scheme: "exact",
        price: async (ctx) => buildPriceObject(await resolveVenueUsd(ctx), KITE_NETWORKS.mainnet),
        network: KITE_NETWORKS.mainnet.network,
        payTo: CONFIG.payTo,
        maxTimeoutSeconds: 300,
      },
      {
        scheme: "exact",
        price: async (ctx) => buildPriceObject(await resolveVenueUsd(ctx), KITE_NETWORKS.testnet),
        network: KITE_NETWORKS.testnet.network,
        payTo: CONFIG.payTo,
        maxTimeoutSeconds: 300,
      },
    ],
    description: "Balian Kite Concierge: Atomic Bali Hospitality Reservation and Consumable Credit Lock",
    mimeType: "application/json",
  },
});

export const x402Middleware: MiddlewareHandler = paymentMiddlewareFromHTTPServer(
  httpResourceServer,
  undefined,
  undefined,
  true,
);
