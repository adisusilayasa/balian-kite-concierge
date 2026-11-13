# OpenServ SERV Hackathon Edition 02 — Submission Kit

**Submission Form:** `https://openserv.typeform.com/submissions02`  
**Deadline:** Sunday, Nov 15, 2026 23:59 UTC (Monday, Nov 16, 2026 07:59 WITA)

---

## 1. Typeform Answers (Copy-Paste Ready)

- **Project Name:** `Balian Kite Concierge`
- **Track:** `Track 02 — Kite ("Shop, book, and pay on your behalf, safely")`
- **Live Demo URL:** `https://concierge.balianapp.com`
- **Demo Video (1080p MP4, 32s):** `https://concierge.balianapp.com/demo.mp4`
- **Interactive Workspace:** `https://concierge.balianapp.com/app`
- **Interactive Pitch Deck:** `https://concierge.balianapp.com/deck`
- **Downloadable PDF Pitch Deck:** `https://concierge.balianapp.com/balian-kite-concierge-deck.pdf`
- **x402 Agent Discovery:** `https://concierge.balianapp.com/.well-known/x402` & `https://concierge.balianapp.com/service.yaml`
- **Public GitHub Repo:** `https://github.com/adisusilayasa/balian-kite-concierge`

### Short Write-Up (Problem, Architecture, & Why Kite + SERV)
> Booking beach clubs, plunge villas, fastboats, and EV transport in Bali still relies on manual WhatsApp invoices, opaque minimum-spend rules, and currency errors. Giving an AI agent unrestricted wallet access creates severe prompt-injection and overspending risks.
>
> **Balian Kite Concierge** separates reasoning from financial authority:
> 1. **OpenServ SERV Reasoning (`gpt-5.4-mini`)** evaluates booking requests with `serv_prompt_guard` and `serv_shadow_agent` tools to verify inventory matches and detect hostile overrides before any payment step executes.
> 2. **Deterministic Policy & Kite Passport Caps** clamp every reservation against live SQLite unit truth, enforce per-transaction (`$80`) and session (`$150`) budgets, pivot sold-out cabanas to nearest open beds, and split group costs via shareable URLs.
> 3. **Dual-Chain Kite x402 Protocol (`@x402/hono` + Pieverse Facilitator v2)** advertises both Kite Mainnet (`eip155:2366` `USDC.e`) and Kite Testnet (`eip155:2368` `pieUSD`) inside live `HTTP 402 PAYMENT-REQUIRED` headers, supports in-browser EIP-3009 `TransferWithAuthorization` signing, and includes a `schema: 1` `service.yaml` registry manifest.
> 4. **Indonesia Currency Law Gate (UU No. 7/2011 Pasal 21(2)(c))** routes cross-border travelers via x402 `USDC.e` and deterministically routes domestic Indonesian residents to compliant **IDR QRIS**.

---

## 2. 2-Minute Demo Video Shot List (Screen Recording)

1. **0:00–0:20 (Landing `/`):** Show `https://concierge.balianapp.com`, click **Prompt injection (Block)** in the live SERV Reasoning widget to prove hostile requests fail cleanly right on the front page.
2. **0:20–0:55 (Interactive Bali Map & Booking `/app`):** Open `/app`, click **S1 Infinity Bed ($68)** directly on the interactive Bali cliffside SVG map, highlight the **Group Split-Pay** share (`$34.00 / guest`), click **Sunset bed ($68)** → show `SERV Live API` (`chatcmpl-...`) + `serv_prompt_guard`, click **Settle $68.00 via Sandbox x402 Passkey** → KPI cap updates `$132.00` → `$64.00`.
3. **0:55–1:25 (Guardrails & HTTP 402 Proof):** Click **Villa over cap ($195)** → `HOLD_EXCEEDS_CAP`; click **Full booked check (S4 Cabana)** → `BLOCK_SOLD_OUT` with 1-click switch to open unit `S1`; click **Test live x402 402** → show decoded dual-chain (`eip155:2366` + `eip155:2368`) `PAYMENT-REQUIRED` JSON.
4. **1:25–1:50 (UU 7/2011 Compliance & Pitch Deck `/deck`):** Toggle **Domestic ID (QRIS)** on a `$44` fastboat → `ROUTE_DOMESTIC_QRIS`; finish by flipping through `/deck` (Pitch Deck) & `.well-known/x402`.

---

## 3. X (Twitter) Launch Post Draft

> Just shipped **Balian Kite Concierge** for the @openservai SERV Hackathon Edition 02 (Track 02: Kite)!
>
> Autonomous Bali villa, beach club, & coastal mobility booking guarded by:
> - Live OpenServ SERV Reasoning (`serv_prompt_guard` + `serv_shadow_agent`)
> - Kite Agent Passport caps + dual-chain HTTP 402 (`USDC.e` mainnet + `pieUSD` testnet)
> - Interactive Bali cliffside deck map, split-pay URLs, & UU 7/2011 IDR QRIS compliance
>
> Live app: https://concierge.balianapp.com
> Workspace: https://concierge.balianapp.com/app
> Pitch deck: https://concierge.balianapp.com/deck
>
> Built with @openservai & @GoKiteAI
