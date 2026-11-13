# Balian Kite Concierge

Autonomous Bali hospitality booking agent powered by **OpenServ SERV Reasoning** and **Kite Agent Passport (`x402`)**.

Live Deployment: `https://concierge.balianapp.com`

Built for **SERV Hackathon — Edition 02 (Track 02: Kite)**.

## What It Solves

International travelers and digital nomads in Bali face endless WhatsApp back-and-forth and manual deposit friction when reserving beach club daybeds, clifftop villas, fastboats, and coastal EV rentals. Meanwhile, venues suffer from no-shows and billing confusion over minimum-spend credits.

## Key Capabilities

1. **SERV Reasoning Policy & Threat Shield (`/api/concierge/evaluate`)**:
   - Integrates `https://inference-api.openserv.ai/v1/chat/completions` (`openai` SDK) with **`serv_prompt_guard`** and **`serv_shadow_agent`**.
   - Blocks prompt-injection attacks (such as arbitrary `payTo` wallet overrides or spending-cap bypass instructions) before any payment request executes.
   - Clamps every AI proposal deterministically against live SQLite inventory, capacity limits, and Kite Passport spending sessions.
2. **Dual-Chain Kite x402 Settlement (`/.well-known/x402`, `/service.yaml`, `/api/x402/quote`, `/api/x402/reserve`)**:
   - Uses `@x402/hono`, `@x402/core/server` (`HTTPFacilitatorClient` -> `https://facilitator.pieverse.io/v2`), and `@x402/evm/exact/server` (`ExactEvmScheme`).
   - Advertises **both Kite Mainnet (`eip155:2366`, `USDC.e`) and Kite Testnet (`eip155:2368`, `pieUSD`)** simultaneously in every `HTTP 402` challenge.
   - Supports **Browser EIP-3009 `TransferWithAuthorization` signing** (`window.ethereum`), **Kite Passport CLI (`kpass`)**, and **Sandbox Passkey simulation**.
   - Includes a valid `schema: 1` `service.yaml` manifest compatible with `gokite-ai/kite-x402-services` and `kite-x402-explorer`.
3. **Interactive Bali Floor & Coastal Map + Group Split-Pay**:
   - Interactive architectural SVG deck & island hub map with real-time `Asia/Makassar` (`WITA`) sunset countdown (`18:18 WITA`), tide telemetry, multi-currency switcher (`USD`/`IDR`/`AUD`), bilingual toggle (`EN`/`ID`), and shareable per-guest split-pay URLs (`?venue=...&pax=...`).
4. **Indonesia Currency Compliance Gate (UU No. 7/2011 Pasal 21(2)(c))**:
   - Distinguishes cross-border traveler agentic settlement (`x402 USDC.e` permitted) from domestic retail transactions (deterministically routed to **IDR QRIS**).

## Endpoints

- `GET /healthz` — Liveness probe
- `GET /readyz` — Verifies Pieverse Facilitator `/v2/supported` offers Kite and checks SERV configuration
- `GET /.well-known/x402` — Machine-readable x402 agent discovery & pricing schema
- `GET /service.yaml` — Kite Service Registry manifest (`schema: 1`)
- `GET /api/x402/quote?venueId=azure-s1` — x402-gated quote endpoint (`$0.05`)
- `POST /api/x402/reserve` — x402-gated atomic booking endpoint (dynamic venue price)
- `POST /api/concierge/evaluate` — SERV Reasoning + Kite Policy evaluation
- `POST /api/concierge/settle-sandbox` — Browser sandbox passkey / compliant IDR QRIS demo settlement
- `POST /api/sessions` — Create, update, pause, or reset Kite Passport session allowances

## Quick Start

```bash
cp .env.example .env
# Add your SERV_API_KEY (from https://console.openserv.ai/) and PAY_TO EVM address
npm install
npm start
```

Server binds to `http://127.0.0.1:8130` by default.
