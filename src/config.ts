import fs from "node:fs";
import path from "node:path";

function loadDotEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env"));

export interface KiteNetworkInfo {
  readonly id: "mainnet" | "testnet";
  readonly network: `${string}:${string}`;
  readonly chainId: number;
  readonly asset: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly name: string;
  readonly version: string;
  readonly explorer: string;
}

export const KITE_NETWORKS: Record<"mainnet" | "testnet", KiteNetworkInfo> = {
  mainnet: {
    id: "mainnet",
    network: "eip155:2366",
    chainId: 2366,
    asset: "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e",
    symbol: "USDC.e",
    decimals: 6,
    name: "Bridged USDC (Kite AI)",
    version: "2",
    explorer: "https://kitescan.ai",
  },
  testnet: {
    id: "testnet",
    network: "eip155:2368",
    chainId: 2368,
    asset: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
    symbol: "pieUSD",
    decimals: 18,
    name: "pieUSD",
    version: "1",
    explorer: "https://testnet.kitescan.ai",
  },
};

const rawNet = (process.env.KITE_NETWORK || "mainnet").toLowerCase();
export const activeChain: KiteNetworkInfo =
  rawNet === "testnet" || rawNet === "2368" || rawNet === "eip155:2368"
    ? KITE_NETWORKS.testnet
    : KITE_NETWORKS.mainnet;

export const CONFIG = {
  port: Number(process.env.PORT || 8130),
  publicUrl: (process.env.PUBLIC_URL || "https://concierge.balianapp.com").replace(/\/$/, ""),
  facilitatorUrl: (process.env.FACILITATOR_URL || "https://facilitator.pieverse.io/v2").replace(/\/$/, ""),
  payTo: (process.env.PAY_TO || "0x0f293A120B37Cd384287712A7Fe5b0ED379395D4") as `0x${string}`,
  servApiKey: (process.env.SERV_API_KEY || "").trim(),
  servBaseUrl: (process.env.SERV_BASE_URL || "https://inference-api.openserv.ai/v1").replace(/\/$/, ""),
  servModel: (process.env.SERV_MODEL || "gpt-5.4-mini").trim(),
  chain: activeChain,
};

// Realistic clamped Bali FX rates (protecting against upstream spike/inversion)
export function clampUsdIdrRate(raw?: number): number {
  if (raw && Number.isFinite(raw) && raw >= 15000 && raw <= 17000) return raw;
  return 16250;
}

export const FX = {
  USD: 1,
  IDR: clampUsdIdrRate(),
  AUD: 1.54,
};

export function toAtomicAmount(usdAmount: number, decimals: number): string {
  const fixed = Math.max(0.0001, usdAmount).toFixed(Math.min(6, decimals));
  const [whole = "0", frac = ""] = fixed.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + padded).toString();
}
