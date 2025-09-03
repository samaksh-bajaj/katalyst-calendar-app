import { toDurationMins } from "./time";
import type { Meeting } from "@/types";
import { headers } from "next/headers";

/* ---------- URL + headers ---------- */

function absoluteUrl(path: string) {
  if (path.startsWith("http")) return path;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

const endpoint = process.env.NEXT_PUBLIC_MCP_URL || "/api/mcp";
const target = endpoint.startsWith("http") ? endpoint : absoluteUrl(endpoint);

const MCP_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  // Composio often streams responses (SSE), so accept both:
  accept: "application/json, text/event-stream",
  ...(process.env.COMPOSIO_API_KEY ? { authorization: `Bearer ${process.env.COMPOSIO_API_KEY}` } : {}),
};

const DEBUG = process.env.NODE_ENV !== "production" ? true : false;

/* ---------- Minimal SSE-aware JSON-RPC client (never throws) ---------- */

type McpResult = { ok: true; result: any } | { ok: false; result: null };

async function mcp(method: string, params: any): Promise<McpResult> {
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
      cache: "no-store",
    });

    const text = await res.text(); // may be JSON or SSE
    if (DEBUG) console.error(`[MCP ${method}] first 200 bytes:\n${text.slice(0, 200)}`);

    // If SSE: find the last "data:" JSON line (some servers send multiple chunks)
    if (text.startsWith("event:")) {
      const dataLines = text
        .split("\n")
        .filter((ln) => ln.trim().startsWith("data:"))
        .map((ln) => ln.replace(/^data:\s*/, "").trim());
      if (!dataLines.length) {
        console.error("[MCP] SSE but no data lines");
        return { ok: false, result: null };
      }
      // Use the last data line (often contains the final JSON-RPC payload)
      try {
        const json = JSON.parse(dataLines[dataLines.length - 1] || "{}");
        if (json?.error) {
          console.error("[MCP] JSON-RPC error:", json.error);
          return { ok: false, result: null };
        }
        return { ok: true, result: json?.result ?? null };
      } catch (e) {
        console.error("[MCP] Failed to parse SSE JSON:", e);
        return { ok: false, result: null };
      }
    }

    // Plain JSON fallback
    const json = JSON.parse(text || "{}");
    if (json?.error) {
      console.error("[MCP] JSON-RPC error:", json.error);
      return { ok: false, result: null };
    }
    return { ok: true, result: json?.result ?? null };
  } catch (e: any) {
    console.error("[MCP] fetch failed:", e?.message || e);
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

type McpTool = { name: string; description?: string; inputSchema?: unknown };

async function mcpListTools(): Promise<McpTool[]> {
  const r = await mcp("tools/list", {});
  if (!r.ok) return [];
  const result = r.result;
  const tools = (Array.isArray(result) ? result : result?.tools) as McpTool[] | undefined;
  if (tools && DEBUG) console.error("[MCP] tools:", tools.map((t) => t.name).join(", "));
  return tools ?? [];
}

async function mcpCallTool(name: string, args: Record<string, any>) {
  const r = await mcp("tools/call", { name, arguments: args });
  return r.ok ? r.result : null;
}

/* ---------- Tool pickers ---------- */

function pickTool(tools: McpTool[], predicates: ((n: string) => boolean)[]): McpTool | null {
  for (const t of tools) {
    const n = (t.name || "").toLowerCase();
    if (predicates.every((p) => p(n))) return t;
  }
  return null;
}

// Common Composio names we care about:
// - GOOGLECALENDAR_CALENDAR_LIST_LIST   (list calendars)
// - GOOGLECALENDAR_EVENTS_LIST          (list events)
function pickCalendarListTool(tools: McpTool[]) {
  return (
    pickTool(tools, [
      (n) => n.includes("calendar"),
      (n) => n.includes("list"),
      (n) => n.includes("calendar_list") || n.includes("calendarlist") || n.includes("calendar_list_list") || n.includes("calendars_list"),
    ]) ||
    pickTool(tools, [(n) => n.includes("calendar_list") && n.includes("list")]) ||
    pickTool(tools, [(n) => n.includes("calendars") && n.includes("list")])
  );
}

function pickEventsListTool(tools: McpTool[]) {
  return (
    pickTool(tools, [(n) => n.includes("events") && n.includes("list")]) ||
    pickTool(tools, [(n) => n.includes("event") && n.includes("list")])
  );
}

/* ---------- Normalization ---------- */

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

/* ---------- Public: fetch meetings via Composio (with calendar discovery) ---------- */

export async function fetchMeetingsViaMCP() {
  // Fallback to internal mock if no Composio URL set
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
      console.error("[MCP] local mock failed:", e?.message || e);
      return { upcoming: [], past: [] };
    }
  }

  // Real Composio MCP flow
  await mcpInitialize();
  const tools = await mcpListTools();

  const calListTool = pickCalendarListTool(tools);
  const eventsTool  = pickEventsListTool(tools);

  if (!eventsTool) {
    console.error("[MCP] No EVENTS_LIST tool found. Tools available:", tools.map(t=>t.name));
    return { upcoming: [], past: [] };
  }

  // 1) Discover calendars (if tool exists). If not, fall back to "primary".
  let calendarIds: string[] = ["primary"];
  if (calListTool) {
    const calListResult = await mcpCallTool(calListTool.name, { maxResults: 100 });
    // Try common shapes: items[], calendars[], or raw []
    const calendars = calListResult?.items ?? calListResult?.calendars ?? calListResult ?? [];
    const ids = Array.isArray(calendars)
      ? calendars
          .map((c: any) => c?.id || c?.calendarId)
          .filter((x: any) => typeof x === "string")
      : [];
    if (ids.length) calendarIds = ids;
    if (DEBUG) console.error("[MCP] calendarIds:", calendarIds);
  }

  // 2) Fetch events for each calendar, merge
  const now = new Date();
  const timeMin = new Date(now.getTime() - 7*24*60*60*1000).toISOString();   // 7 days back
  const timeMax = new Date(now.getTime() + 30*24*60*60*1000).toISOString();  // 30 days forward

  let allEvents: RawEvent[] = [];
  for (const calId of calendarIds.slice(0, 5)) { // safety limit
    const args = {
      calendarId: calId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    };
    const result = await mcpCallTool(eventsTool.name, args);
    if (!result) continue;

    const events: RawEvent[] =
      result?.items ??          // Google API normal
      result?.events ??         // alternative
      result?.content?.events ??// some wrappers
      result?.content ?? 
      result ?? [];

    allEvents = allEvents.concat(events || []);
  }

  return splitUpcomingPast(allEvents);
}
