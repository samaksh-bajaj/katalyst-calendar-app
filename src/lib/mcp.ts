// src/lib/mcp.ts
import { toDurationMins } from "./time";
import type { Meeting } from "@/types";
import { headers } from "next/headers";

// Build absolute URL (works on localhost & Vercel)
function absoluteUrl(path: string) {
  if (path.startsWith("http")) return path;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

// If NEXT_PUBLIC_MCP_URL is set, use it; otherwise use internal mock
const endpoint = process.env.NEXT_PUBLIC_MCP_URL || "/api/mcp";
const target = endpoint.startsWith("http") ? endpoint : absoluteUrl(endpoint);

// Optional Composio auth header
const MCP_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  ...(process.env.COMPOSIO_API_KEY ? { authorization: `Bearer ${process.env.COMPOSIO_API_KEY}` } : {}),
};

// ---------- Safe MCP helpers (never throw) ----------
async function mcp(method: string, params: any) {
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
      cache: "no-store",
    });
    const text = await res.text(); // read once
    if (!res.ok) {
      console.error("MCP HTTP error", res.status, text);
      return { ok: false, result: null };
    }
    const json = JSON.parse(text || "{}");
    if (json?.error) {
      console.error("MCP JSON-RPC error", json.error);
      return { ok: false, result: null };
    }
    return { ok: true, result: json?.result ?? null };
  } catch (e: any) {
    console.error("MCP fetch failed:", e?.message || e);
    return { ok: false, result: null };
  }
}

async function mcpInitialize() {
  return mcp("initialize", {
    protocolVersion: "2025-03-26",
    clientInfo: { name: "katalyst-calendar-app", version: "1.0.0" },
    capabilities: {},
  });
}

async function mcpListTools() {
  const r = await mcp("tools/list", {});
  if (!r.ok) return [];
  const result = r.result;
  return Array.isArray(result) ? result : result?.tools ?? [];
}

function pickListEventsTool(tools: any[]) {
  // Composio tool names usually include "list" and "event"
  return tools.find(
    (t: any) => t?.name?.toLowerCase?.().includes("list") && t?.name?.toLowerCase?.().includes("event")
  );
}

async function mcpCallTool(name: string, args: Record<string, any>) {
  const r = await mcp("tools/call", { name, arguments: args });
  return r.ok ? r.result : null;
}

// ---------- Normalization ----------
type RawEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  description?: string;
};

function normalize(raw: RawEvent, now = new Date()): Meeting | null {
  const start = raw.start?.dateTime ?? (raw.start?.date ? `${raw.start.date}T00:00:00Z` : null);
  const end   = raw.end?.dateTime   ?? (raw.end?.date   ? `${raw.end.date}T00:00:00Z`   : null);
  if (!start || !end) return null;
  const isPast = new Date(end).getTime() < now.getTime();
  return {
    id: raw.id,
    title: raw.summary ?? "(No title)",
    start, end,
    durationMins: toDurationMins(start, end),
    attendees: (raw.attendees ?? []).map(a => ({
      email: a.email,
      displayName: a.displayName,
      response: a.responseStatus,
    })),
    description: raw.description,
    isPast,
  };
}

function splitUpcomingPast(rawEvents: RawEvent[]) {
  const mapped = rawEvents.map(e => normalize(e)).filter(Boolean) as Meeting[];
  const now = Date.now();
  const upcoming = mapped.filter(m => +new Date(m.end) >= now).slice(0, 5);
  const past = mapped
    .filter(m => +new Date(m.end) < now)
    .sort((a,b)=>+new Date(b.end)-+new Date(a.end))
    .slice(0,5);
  return { upcoming, past };
}

// ---------- Public API (safe) ----------
export async function fetchMeetingsViaMCP() {
  // 1) If NO Composio URL, use internal mock (never throws)
  if (!process.env.NEXT_PUBLIC_MCP_URL) {
    try {
      const res = await fetch(absoluteUrl("/api/mcp"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "google_calendar.listEvents",
          params: { maxUpcoming: 5, maxPast: 5 },
        }),
        cache: "no-store",
      });
      const json = await res.json();
      const raw: RawEvent[] = json?.result?.events ?? [];
      return splitUpcomingPast(raw);
    } catch (e: any) {
      console.error("Local mock MCP failed:", e?.message || e);
      return { upcoming: [], past: [] };
    }
  }

  // 2) Real Composio MCP flow (all steps safe)
  await mcpInitialize();
  const tools = await mcpListTools();
  const tool = pickListEventsTool(tools);
  if (!tool) {
    console.error("MCP: no 'List Events' tool found");
    return { upcoming: [], past: [] };
  }

  const now = new Date();
  const args = {
    calendarId: "primary",
    timeMin: new Date(now.getTime() - 7*24*60*60*1000).toISOString(),   // 7 days back
    timeMax: new Date(now.getTime() + 30*24*60*60*1000).toISOString(),  // 30 days forward
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  };
  const result = await mcpCallTool(tool.name, args);
  if (!result) return { upcoming: [], past: [] };

  const events: RawEvent[] =
    result?.events ?? result?.content?.events ?? result?.content ?? result ?? [];
  return splitUpcomingPast(events);
}
