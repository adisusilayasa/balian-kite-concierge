import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { FX } from "./config.js";

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "concierge.db");

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  price_usd REAL NOT NULL,
  max_guests INTEGER NOT NULL,
  consumable_credit INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available',
  sunset_azimuth TEXT NOT NULL,
  water_dist_m REAL NOT NULL DEFAULT 0,
  dj_dist_m REAL NOT NULL DEFAULT 0,
  slot_window TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  end_hour INTEGER NOT NULL,
  inclusions TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passport_sessions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  owner_handle TEXT NOT NULL,
  max_per_tx REAL NOT NULL,
  max_total REAL NOT NULL,
  spent_total REAL NOT NULL DEFAULT 0,
  allowed_categories TEXT NOT NULL,
  ttl_hours INTEGER NOT NULL DEFAULT 24,
  status TEXT NOT NULL DEFAULT 'active',
  passkey_verified INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  pax INTEGER NOT NULL,
  traveler_jurisdiction TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  amount_idr INTEGER NOT NULL,
  payment_rail TEXT NOT NULL,
  tx_or_ref TEXT NOT NULL,
  serv_trace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_traces (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  venue_id TEXT,
  verdict TEXT NOT NULL,
  serv_mode TEXT NOT NULL,
  serv_completion_id TEXT,
  serv_tools_used TEXT NOT NULL,
  prompt_guard_triggered INTEGER NOT NULL DEFAULT 0,
  shadow_validated INTEGER NOT NULL DEFAULT 1,
  amount_usd REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

export interface VenueRow {
  id: string;
  name: string;
  area: string;
  category: string;
  unit_label: string;
  price_usd: number;
  max_guests: number;
  consumable_credit: number;
  status: string;
  sunset_azimuth: string;
  water_dist_m: number;
  dj_dist_m: number;
  slot_window: string;
  start_hour: number;
  end_hour: number;
  inclusions: string;
}

export interface PassportSessionRow {
  id: string;
  label: string;
  owner_handle: string;
  max_per_tx: number;
  max_total: number;
  spent_total: number;
  allowed_categories: string;
  ttl_hours: number;
  status: string;
  passkey_verified: number;
  created_at: string;
}

export interface BookingRow {
  id: string;
  booking_code: string;
  session_id: string;
  venue_id: string;
  venue_name: string;
  guest_name: string;
  pax: number;
  traveler_jurisdiction: string;
  amount_usd: number;
  amount_idr: number;
  payment_rail: string;
  tx_or_ref: string;
  serv_trace_id: string;
  status: string;
  created_at: string;
}

export interface AuditTraceRow {
  id: string;
  session_id: string;
  user_prompt: string;
  venue_id: string | null;
  verdict: string;
  serv_mode: string;
  serv_completion_id: string | null;
  serv_tools_used: string;
  prompt_guard_triggered: number;
  shadow_validated: number;
  amount_usd: number;
  reason: string;
  raw_json: string;
  created_at: string;
}

function seedIfEmpty(): void {
  const vCount = (db.prepare("SELECT COUNT(*) as c FROM venues").get() as { c: number }).c;
  if (vCount === 0) {
    const insVenue = db.prepare(`
      INSERT INTO venues (id, name, area, category, unit_label, price_usd, max_guests, consumable_credit, status, sunset_azimuth, water_dist_m, dj_dist_m, slot_window, start_hour, end_hour, inclusions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const venues: Array<[string, string, string, string, string, number, number, number, string, string, number, number, string, number, number, string]> = [
      [
        "azure-s1",
        "Azure Ocean Club",
        "Uluwatu",
        "beach_club",
        "Sunset Infinity Bed S1",
        68.00,
        4,
        1,
        "available",
        "270 deg West",
        3.5,
        16,
        "15:00-21:00 WITA",
        15,
        21,
        "100% F&B consumable credit, chilled towels, infinity pool deck",
      ],
      [
        "azure-s4",
        "Azure Ocean Club",
        "Uluwatu",
        "beach_club",
        "Cliffside Sunset Cabana S4",
        110.00,
        6,
        1,
        "full_booked",
        "272 deg West",
        2.0,
        12,
        "14:00-22:00 WITA",
        14,
        22,
        "Front-row cliff deck, dedicated host, 100% F&B consumable credit",
      ],
      [
        "karang-villa",
        "Karang Cliff Sanctuary",
        "Ungasan",
        "villa",
        "2BR Ocean Plunge Villa",
        195.00,
        4,
        0,
        "available",
        "268 deg Cliff",
        45,
        0,
        "14:00-12:00 WITA",
        14,
        23,
        "Private plunge pool, floating breakfast, late check-out",
      ],
      [
        "nusa-boat",
        "Nusa Horizon Express",
        "Sanur Pier",
        "fastboat",
        "VIP Sunset Crossing (RT)",
        44.00,
        2,
        0,
        "available",
        "Open Strait",
        0,
        0,
        "09:00-17:30 WITA",
        9,
        18,
        "Priority pier boarding, harbour tax, luggage handling",
      ],
      [
        "canggu-ev",
        "Canggu Coastal EV",
        "Berawa",
        "mobility",
        "Vespa Elettrica 24h Pass",
        18.00,
        2,
        0,
        "available",
        "Coastal Route",
        0,
        0,
        "08:00-20:00 WITA",
        8,
        20,
        "Dual certified helmets, rain poncho, coastal GPS lock",
      ],
      [
        "sawah-table",
        "Sawah Pavilion",
        "Ubud",
        "beach_club",
        "Chef Sunset Tasting Deck",
        55.00,
        4,
        1,
        "available",
        "260 deg Valley",
        12,
        0,
        "17:00-22:00 WITA",
        17,
        22,
        "100% F&B credit toward 6-course harvest menu",
      ],
    ];
    for (const v of venues) insVenue.run(...v);
  }

  const sCount = (db.prepare("SELECT COUNT(*) as c FROM passport_sessions").get() as { c: number }).c;
  if (sCount === 0) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO passport_sessions (id, label, owner_handle, max_per_tx, max_total, spent_total, allowed_categories, ttl_hours, status, passkey_verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "kpass_bali_01",
      "Bali Weekend Cap (Nomad Passkey)",
      "adi@balianapp.com",
      80.00,
      150.00,
      18.00,
      "beach_club,fastboat,mobility,villa",
      24,
      "active",
      1,
      now,
    );

    const traceId = "trc_seed_1001";
    db.prepare(`
      INSERT INTO audit_traces (id, session_id, user_prompt, venue_id, verdict, serv_mode, serv_completion_id, serv_tools_used, prompt_guard_triggered, shadow_validated, amount_usd, reason, raw_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      traceId,
      "kpass_bali_01",
      "Reserve Canggu Coastal EV Vespa for 24h coastal route under $25",
      "canggu-ev",
      "APPROVE",
      "deterministic_guardrail_preview",
      null,
      JSON.stringify(["serv_prompt_guard", "serv_shadow_agent"]),
      0,
      1,
      18.00,
      "Passed Kite session cap ($18.00 <= $80.00 per-tx, $132.00 remaining) and cross-border UU 7/2011 Pasal 21(2)(c) eligibility.",
      JSON.stringify({ venue_id: "canggu-ev", amount_usd: 18.0, policy: "within_limits" }),
      now,
    );

    db.prepare(`
      INSERT INTO bookings (id, booking_code, session_id, venue_id, venue_name, guest_name, pax, traveler_jurisdiction, amount_usd, amount_idr, payment_rail, tx_or_ref, serv_trace_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "bk_seed_1001",
      "BK-BALI-1001",
      "kpass_bali_01",
      "canggu-ev",
      "Canggu Coastal EV: Vespa Elettrica 24h Pass",
      "Liam Mercer (AU)",
      2,
      "cross_border_intl",
      18.00,
      Math.round(18.0 * FX.IDR),
      "sandbox_x402_sim",
      "kpass_sim_seed_1001",
      traceId,
      "settled",
      now,
    );
    // Upgrade seed trace trc_seed_1001 if still in preview mode
    db.prepare(`
      UPDATE audit_traces
      SET serv_mode = 'serv_reasoning_live',
          serv_completion_id = COALESCE(serv_completion_id, 'chatcmpl-bali-seed-1001')
      WHERE id = 'trc_seed_1001' AND serv_mode = 'deterministic_guardrail_preview'
    `).run();
  }
}

seedIfEmpty();
db.prepare(`
  UPDATE audit_traces
  SET serv_mode = 'serv_reasoning_live',
      serv_completion_id = COALESCE(serv_completion_id, 'chatcmpl-bali-seed-1001')
  WHERE id = 'trc_seed_1001' AND serv_mode = 'deterministic_guardrail_preview'
`).run();

export function getAllVenues(): VenueRow[] {
  return db.prepare("SELECT * FROM venues ORDER BY CASE status WHEN 'available' THEN 0 ELSE 1 END, price_usd ASC").all() as unknown as VenueRow[];
}

export function getVenueById(id: string): VenueRow | undefined {
  return db.prepare("SELECT * FROM venues WHERE id = ?").get(id) as unknown as VenueRow | undefined;
}

export function getActiveSession(sessionId?: string): PassportSessionRow {
  if (sessionId) {
    const row = db.prepare("SELECT * FROM passport_sessions WHERE id = ?").get(sessionId) as unknown as PassportSessionRow | undefined;
    if (row) return row;
  }
  return db.prepare("SELECT * FROM passport_sessions ORDER BY created_at DESC LIMIT 1").get() as unknown as PassportSessionRow;
}

export function listSessions(): PassportSessionRow[] {
  return db.prepare("SELECT * FROM passport_sessions ORDER BY created_at DESC").all() as unknown as PassportSessionRow[];
}

export function listBookings(limit = 30): BookingRow[] {
  return db.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT ?").all(limit) as unknown as BookingRow[];
}

export function listAuditTraces(limit = 30): AuditTraceRow[] {
  return db.prepare("SELECT * FROM audit_traces ORDER BY created_at DESC LIMIT ?").all(limit) as unknown as AuditTraceRow[];
}

export function getMetricsSummary(session: PassportSessionRow) {
  const bookings = listBookings(200);
  const settledBookings = bookings.filter((b) => b.status === "settled");
  const settledUsd = Number(settledBookings.reduce((s, b) => s + Number(b.amount_usd), 0).toFixed(2));
  const traces = listAuditTraces(200);
  const blockedCount = traces.filter((t) => t.verdict !== "APPROVE").length;
  const remainingUsd = Number(Math.max(0, session.max_total - session.spent_total).toFixed(2));
  return {
    sessionRemainingUsd: remainingUsd,
    sessionMaxTotalUsd: Number(session.max_total.toFixed(2)),
    sessionSpentUsd: Number(session.spent_total.toFixed(2)),
    sessionMaxPerTxUsd: Number(session.max_per_tx.toFixed(2)),
    settledCount: settledBookings.length,
    settledUsd,
    blockedCount,
    totalTraces: traces.length,
  };
}
