import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { CONFIG, FX, KITE_NETWORKS, toAtomicAmount } from "./config.js";
import {
  db,
  getActiveSession,
  getAllVenues,
  getMetricsSummary,
  getVenueById,
  listAuditTraces,
  listBookings,
  listSessions,
} from "./db.js";
import { evaluateBookingWithSERV } from "./serv.js";
import { facilitatorClient, x402Middleware } from "./x402.js";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Payment-Signature", "X-Payment"],
    exposeHeaders: ["Payment-Required", "Payment-Response", "X-Payment-Required", "X-Payment-Response"],
  }),
);

// Real x402 payment protection on /api/x402/*
app.use("/api/x402/*", x402Middleware);

function computeBaliTelemetry() {
  const now = new Date();
  const witaStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const [hh, mm] = witaStr.split(":").map(Number);
  const nowMins = (hh || 0) * 60 + (mm || 0);
  const sunsetMins = 18 * 60 + 18; // November Bali sunset ~18:18 WITA
  let diff = sunsetMins - nowMins;
  if (diff < 0) diff += 24 * 60;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    timezone: "Asia/Makassar (WITA)",
    localTime: witaStr,
    sunsetWita: "18:18 WITA",
    goldenHourWita: "17:42 WITA",
    countdownLabel: diff <= 120 ? `Sunset in ${hrs}h ${mins}m` : `Next sunset in ${hrs}h ${mins}m`,
    tideMeters: 0.7,
    tidePhase: "Low Tide · Reef & Beach Access",
    windKnots: 9,
    fxRates: FX,
  };
}

app.get("/healthz", (c) =>
  c.json({
    ok: true,
    service: "balian-kite-concierge",
    network: CONFIG.chain.network,
    asset: CONFIG.chain.symbol,
    servConfigured: Boolean(CONFIG.servApiKey),
  }),
);

app.get("/readyz", async (c) => {
  try {
    const supported = await facilitatorClient.getSupported();
    const networkOffered = supported.kinds.some(
      (k) => k.network === CONFIG.chain.network && k.scheme === "exact" && k.x402Version === 2,
    );
    return c.json(
      {
        ok: networkOffered,
        facilitator: CONFIG.facilitatorUrl,
        network: CONFIG.chain.network,
        networkOffered,
        servConfigured: Boolean(CONFIG.servApiKey),
        servModel: CONFIG.servModel,
      },
      networkOffered ? 200 : 503,
      { "Cache-Control": "no-store" },
    );
  } catch (err) {
    return c.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "facilitator_unavailable",
        facilitator: CONFIG.facilitatorUrl,
        servConfigured: Boolean(CONFIG.servApiKey),
      },
      503,
      { "Cache-Control": "no-store" },
    );
  }
});

app.get("/service.yaml", (c) => {
  const yamlPath = path.resolve(process.cwd(), "service.yaml");
  const content = fs.existsSync(yamlPath) ? fs.readFileSync(yamlPath, "utf8") : "";
  return c.text(content, 200, { "Content-Type": "text/yaml; charset=utf-8" });
});

app.get("/.well-known/x402", (c) => {
  return c.json({
    x402Version: 2,
    service: "Balian Kite Concierge",
    description:
      "Autonomous Bali hospitality booking agent powered by OpenServ SERV Reasoning and Kite Agent Passport x402 settlement.",
    scheme: "exact",
    networks: [KITE_NETWORKS.mainnet, KITE_NETWORKS.testnet],
    network: CONFIG.chain.network,
    chainId: CONFIG.chain.chainId,
    asset: {
      address: CONFIG.chain.asset,
      symbol: CONFIG.chain.symbol,
      decimals: CONFIG.chain.decimals,
      name: CONFIG.chain.name,
      version: CONFIG.chain.version,
    },
    payTo: CONFIG.payTo,
    facilitator: CONFIG.facilitatorUrl,
    serviceYaml: `${CONFIG.publicUrl}/service.yaml`,
    endpoints: [
      {
        method: "GET",
        path: `${CONFIG.publicUrl}/api/x402/quote`,
        priceUsd: "$0.05",
        atomicAmount: toAtomicAmount(0.05, CONFIG.chain.decimals),
        description: "Verified Bali venue availability quote & sunset telemetry",
      },
      {
        method: "POST",
        path: `${CONFIG.publicUrl}/api/x402/reserve`,
        priceUsd: "dynamic (venue price USD)",
        description: "Atomic Bali venue reservation & 100% consumable credit lock",
      },
    ],
    compliance: {
      jurisdiction: "Indonesia",
      statute: "UU No. 7/2011 Pasal 21 ayat 2(c)",
      note: "x402 stablecoin settlement permitted exclusively for cross-border international bookings; domestic retail routes to IDR QRIS.",
    },
  });
});

app.get("/api/state", (c) => {
  const sessionId = c.req.query("sessionId") || undefined;
  const activeSession = getActiveSession(sessionId);
  const venues = getAllVenues();
  const sessions = listSessions();
  const bookings = listBookings(30);
  const auditTraces = listAuditTraces(30);
  const metrics = getMetricsSummary(activeSession);

  return c.json(
    {
      venues,
      sessions,
      activeSession,
      bookings,
      auditTraces,
      metrics,
      baliTelemetry: computeBaliTelemetry(),
      protocol: {
        network: CONFIG.chain.network,
        chainId: CONFIG.chain.chainId,
        symbol: CONFIG.chain.symbol,
        asset: CONFIG.chain.asset,
        networks: KITE_NETWORKS,
        payTo: CONFIG.payTo,
        facilitatorUrl: CONFIG.facilitatorUrl,
        explorer: CONFIG.chain.explorer,
        servConfigured: Boolean(CONFIG.servApiKey),
        servModel: CONFIG.servModel,
        publicUrl: CONFIG.publicUrl,
      },
    },
    200,
    { "Cache-Control": "no-store" },
  );
});

app.post("/api/concierge/evaluate", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return c.json({ error: "Please enter a booking request prompt." }, 400);
  }
  const result = await evaluateBookingWithSERV({
    prompt,
    venueId: typeof body.venueId === "string" ? body.venueId : undefined,
    pax: typeof body.pax === "number" ? body.pax : Number(body.pax || 2),
    sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
    travelerJurisdiction:
      body.travelerJurisdiction === "domestic_indonesia" ? "domestic_indonesia" : "cross_border_intl",
  });
  const activeSession = getActiveSession(typeof body.sessionId === "string" ? body.sessionId : undefined);
  return c.json({
    evaluation: result,
    metrics: getMetricsSummary(activeSession),
    auditTraces: listAuditTraces(30),
  });
});

app.post("/api/concierge/settle-sandbox", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const traceId = typeof body.traceId === "string" ? body.traceId : "";
  const venueId = typeof body.venueId === "string" ? body.venueId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const guestName = typeof body.guestName === "string" && body.guestName.trim() ? body.guestName.trim() : "Kite Passport Guest";
  const pax = Math.max(1, Math.min(12, Number(body.pax || 2)));
  const travelerJurisdiction =
    body.travelerJurisdiction === "domestic_indonesia" ? "domestic_indonesia" : "cross_border_intl";

  const trace = db.prepare("SELECT * FROM audit_traces WHERE id = ?").get(traceId) as
    | { id: string; verdict: string; session_id: string; venue_id: string | null }
    | undefined;

  if (!trace || (trace.verdict !== "APPROVE" && trace.verdict !== "ROUTE_DOMESTIC_QRIS")) {
    return c.json(
      { error: "Settlement blocked: only SERV-approved or QRIS-routed evaluations can settle." },
      403,
    );
  }

  const targetVenueId = venueId || trace.venue_id || "";
  const venue = getVenueById(targetVenueId);
  if (!venue || venue.status !== "available") {
    return c.json({ error: "Selected venue is unavailable or full booked." }, 409);
  }

  const bookingId = "bk_" + crypto.randomUUID().slice(0, 10);
  const bookingCode = "BK-BALI-" + Math.floor(1000 + Math.random() * 9000);
  const amountUsd = Number(venue.price_usd.toFixed(2));
  const amountIdr = Math.round(amountUsd * FX.IDR);
  const now = new Date().toISOString();
  const isDomestic = travelerJurisdiction === "domestic_indonesia" || trace.verdict === "ROUTE_DOMESTIC_QRIS";
  const paymentRail = isDomestic ? "domestic_qris_idr" : "sandbox_x402_sim";
  const txRef = isDomestic
    ? `qris_id_${crypto.randomBytes(6).toString("hex")}`
    : `kpass_sandbox_${crypto.randomBytes(6).toString("hex")}`;

  db.exec("BEGIN IMMEDIATE");
  try {
    const sess = getActiveSession(sessionId || trace.session_id);
    if (sess.status !== "active") {
      throw new Error("Kite Passport session is paused or revoked.");
    }
    if (amountUsd > sess.max_per_tx) {
      throw new Error(`Amount $${amountUsd.toFixed(2)} exceeds per-tx cap $${sess.max_per_tx.toFixed(2)}.`);
    }
    if (sess.spent_total + amountUsd > sess.max_total) {
      throw new Error("Insufficient Kite Passport session balance remaining.");
    }

    db.prepare("UPDATE passport_sessions SET spent_total = ROUND(spent_total + ?, 2) WHERE id = ?").run(
      amountUsd,
      sess.id,
    );
    db.prepare(`
      INSERT INTO bookings (id, booking_code, session_id, venue_id, venue_name, guest_name, pax, traveler_jurisdiction, amount_usd, amount_idr, payment_rail, tx_or_ref, serv_trace_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingId,
      bookingCode,
      sess.id,
      venue.id,
      `${venue.name}: ${venue.unit_label}`,
      guestName,
      pax,
      travelerJurisdiction,
      amountUsd,
      amountIdr,
      paymentRail,
      txRef,
      trace.id,
      "settled",
      now,
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return c.json({ error: err instanceof Error ? err.message : "Settlement error" }, 409);
  }

  const activeSession = getActiveSession(sessionId || trace.session_id);
  const createdBooking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  return c.json({
    ok: true,
    booking: createdBooking,
    activeSession,
    sessions: listSessions(),
    bookings: listBookings(30),
    metrics: getMetricsSummary(activeSession),
  });
});

app.post("/api/sessions", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "update";

  if (action === "reset_demo") {
    db.prepare("UPDATE passport_sessions SET spent_total = 18.00, status = 'active', max_per_tx = 80.00, max_total = 150.00 WHERE id = 'kpass_bali_01'").run();
    const active = getActiveSession("kpass_bali_01");
    return c.json({ ok: true, activeSession: active, sessions: listSessions(), metrics: getMetricsSummary(active) });
  }

  if (action === "create") {
    const id = "kpass_" + crypto.randomBytes(4).toString("hex");
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Custom Kite Session";
    const maxPerTx = Math.max(5, Math.min(2000, Number(body.max_per_tx || 80)));
    const maxTotal = Math.max(maxPerTx, Math.min(5000, Number(body.max_total || 150)));
    const ttlHours = Math.max(1, Math.min(168, Number(body.ttl_hours || 24)));
    const allowedCategories =
      Array.isArray(body.allowed_categories) && body.allowed_categories.length > 0
        ? body.allowed_categories.map(String).join(",")
        : "beach_club,fastboat,mobility,villa";

    db.prepare(`
      INSERT INTO passport_sessions (id, label, owner_handle, max_per_tx, max_total, spent_total, allowed_categories, ttl_hours, status, passkey_verified, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'active', 1, ?)
    `).run(id, label, "adi@balianapp.com", maxPerTx, maxTotal, allowedCategories, ttlHours, new Date().toISOString());

    const active = getActiveSession(id);
    return c.json({ ok: true, activeSession: active, sessions: listSessions(), metrics: getMetricsSummary(active) });
  }

  // Update existing session
  const sessionId = typeof body.id === "string" ? body.id : getActiveSession().id;
  const maxPerTx = Math.max(5, Math.min(2000, Number(body.max_per_tx || 80)));
  const maxTotal = Math.max(maxPerTx, Math.min(5000, Number(body.max_total || 150)));
  const status = body.status === "paused" ? "paused" : "active";
  const allowedCategories =
    Array.isArray(body.allowed_categories) && body.allowed_categories.length > 0
      ? body.allowed_categories.map(String).join(",")
      : typeof body.allowed_categories === "string" && body.allowed_categories.trim()
        ? body.allowed_categories.trim()
        : "beach_club,fastboat,mobility,villa";

  db.prepare(`
    UPDATE passport_sessions
    SET max_per_tx = ?, max_total = ?, status = ?, allowed_categories = ?
    WHERE id = ?
  `).run(maxPerTx, maxTotal, status, allowedCategories, sessionId);

  const active = getActiveSession(sessionId);
  return c.json({ ok: true, activeSession: active, sessions: listSessions(), metrics: getMetricsSummary(active) });
});

// Paid x402 route handlers (reached ONLY after x402Middleware verifies + settles payment via Pieverse)
app.get("/api/x402/quote", (c) => {
  const venueId = c.req.query("venueId") || "azure-s1";
  const venue = getVenueById(venueId) || getAllVenues()[0];
  return c.json({
    ok: true,
    paidVia: "x402",
    network: CONFIG.chain.network,
    asset: CONFIG.chain.symbol,
    venue,
    baliTelemetry: computeBaliTelemetry(),
    quotedAt: new Date().toISOString(),
  });
});

app.post("/api/x402/reserve", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const venueId = typeof body.venueId === "string" ? body.venueId : c.req.query("venueId") || "azure-s1";
  const guestName = typeof body.guestName === "string" && body.guestName.trim() ? body.guestName.trim() : "x402 Autonomous Agent";
  const pax = Math.max(1, Math.min(12, Number(body.pax || 2)));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : getActiveSession().id;

  const venue = getVenueById(venueId);
  if (!venue || venue.status !== "available") {
    return c.json({ error: "Requested venue unavailable." }, 409);
  }

  const bookingId = "bk_" + crypto.randomUUID().slice(0, 10);
  const bookingCode = "BK-KITE-" + Math.floor(1000 + Math.random() * 9000);
  const amountUsd = Number(venue.price_usd.toFixed(2));
  const amountIdr = Math.round(amountUsd * FX.IDR);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO bookings (id, booking_code, session_id, venue_id, venue_name, guest_name, pax, traveler_jurisdiction, amount_usd, amount_idr, payment_rail, tx_or_ref, serv_trace_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cross_border_intl', ?, ?, 'x402_kite_usdc', ?, 'x402_direct', 'settled', ?)
  `).run(
    bookingId,
    bookingCode,
    sessionId,
    venue.id,
    `${venue.name}: ${venue.unit_label}`,
    guestName,
    pax,
    amountUsd,
    amountIdr,
    c.res.headers.get("Payment-Response") || c.res.headers.get("X-Payment-Response") || `x402_${crypto.randomBytes(6).toString("hex")}`,
    now,
  );

  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  return c.json({
    ok: true,
    paidVia: "x402",
    network: CONFIG.chain.network,
    booking,
  });
});

// Serve clean static frontend from ./public
app.use("/*", serveStatic({ root: "./public" }));

serve({
  fetch: app.fetch,
  port: CONFIG.port,
  hostname: "127.0.0.1",
});

console.log(`Balian Kite Concierge listening on http://127.0.0.1:${CONFIG.port} (${CONFIG.chain.network} / ${CONFIG.chain.symbol})`);
