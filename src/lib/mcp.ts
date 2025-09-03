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
  accept: "application/json, text/event-stream",
  ...(process.env.COMPOSIO_API_KEY ? { authorization: `Bearer ${process.env.COMPOSIO_API_KEY}` } : {}),
};

const DEBUG = true; // leave on while integrating

/* ---------- Helpers to handle Composio's SSE payload shape ---------- */

function unpackMcpPayload(result: any): any {
  // Composio often returns: { content: [{ type:"text", text: "{...json...}" }] }
  if (result && Array.isArray(result.content)) {
    // pick last text block
    const lastText = [...result.content]
      .reverse()
      .find((c: any) => typeof c?.text === "string")?.text;
    if (lastText) {
      try {
        const parsed = JSON.parse(lastText);
        // If that parsed object nests data (successfull/error/data/logs), return it
        return parsed ?? result;
      } catch {
        // not JSON, fall through
      }
    }
  }
  return result;
}

/* ---------- SSE-aware JSON-RPC wrapper (safe, never throws) ---------- */

type McpCall = { ok: true; result: any } | { ok: false; result: null };

async function mcp(method: string, params: any): Promise<McpCall> {
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
      cache: "no-store",
    });

    const text = await res.text();
    if (DEBUG) console.error(`[MCP ${method}] raw response:\n${text.slice(0, 500)}`);

    // SSE: "event: message\n data: {...}"
    if (text.startsWith("event:")) {
      const dataLines = text
        .split("\n")
        .filter((ln) => ln.trim().startsWith("data:"))
        .map((ln) => ln.replace(/^data:\s*/, "").trim());
      if (!dataLines.length) {
        console.error("[MCP] SSE but no data lines");
        return { ok: false, result: null };
      }
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

    // Plain JSON
    const json = JSON.parse(text || "{}");
    if (json?.error) {
      console.error("[MCP] JSON-RPC error", json.error);
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
  if (tools) console.error("[MCP] tools:", tools.map((t) => t.name));
  return tools ?? [];
}

// UNWRAPPED result for tools/call
async function mcpCallTool(name: string, args: Record<string, any>): Promise<any | null> {
  const r = await mcp("tools/call", { name, arguments: args });
  return r.ok ? unpackMcpPayload(r.result) : null;
}

/* ---------- Pick the correct tools (prefer exact names) ---------- */

function pickEventsListTool(tools: McpTool[]) {
  // Prefer exact / strong matches first
  const exact = tools.find((t) => t.name.toUpperCase() === "GOOGLECALENDAR_EVENTS_LIST");
  if (exact) return exact;
  // Fallback heuristic
  return (
    tools.find((t) => {
      const n = (t.name || "").toLowerCase();
      return n.includes("events") && n.includes("list");
    }) ?? null
  );
}

function pickCalendarListTool(tools: McpTool[]) {
  // Prefer LIST_CALENDARS (not CALENDAR_LIST_INSERT)
  const exact = tools.find((t) => t.name.toUpperCase() === "GOOGLECALENDAR_LIST_CALENDARS");
  if (exact) return exact;
  // Other sane list-calendars names
  const alts = tools.find((t) => {
    const n = (t.name || "").toLowerCase();
    return n.includes("calendars") && n.includes("list");
  });
  if (alts) return alts;
  // Last resort: anything with "calendar" + "list" but avoid "insert"/"update"
  return (
    tools.find((t) => {
      const n = (t.name || "").toLowerCase();
      return n.includes("calendar") && n.includes("list") && !n.includes("insert") && !n.includes("update");
    }) ?? null
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

/* ---------- Public: fetch meetings via Composio ---------- */

export async function fetchMeetingsViaMCP() {
  if (!process.env.NEXT_PUBLIC_MCP_URL) {
    console.error("[MCP] No MCP URL set, falling back to mock");
    return { upcoming: [], past: [] };
  }

  await mcpInitialize();
  const tools = await mcpListTools();

  const eventsTool = pickEventsListTool(tools);
  const calListTool = pickCalendarListTool(tools);

  if (!eventsTool) {
    console.error("[MCP] No EVENTS_LIST tool found");
    return { upcoming: [], past: [] };
  }

  // 1) List calendars (prefer tool, else 'primary')
  let calendarIds: string[] = ["primary"];
  if (calListTool) {
    const calListPayload: any = await mcpCallTool(calListTool.name, { maxResults: 100 });
    console.error("[MCP] raw calendar list payload:", JSON.stringify(calListPayload).slice(0, 600));

    // Common shapes seen from Composio:
    // { successfull, error, data: { items: [...] } }
    // or { items: [...] } or just [...]
    const calendars =
      calListPayload?.data?.items ??
      calListPayload?.items ??
      (Array.isArray(calListPayload) ? calListPayload : []);

    const ids =
      Array.isArray(calendars)
        ? calendars.map((c: any) => c?.id || c?.calendarId).filter((x: any) => typeof x === "string")
        : [];

    if (ids.length) calendarIds = ids;
    console.error("[MCP] calendarIds:", calendarIds);
  }

  // 2) List events per calendar (merge)
  const now = new Date();
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let allEvents: RawEvent[] = [];
  for (const calId of calendarIds.slice(0, 8)) {
    const args = {
      calendarId: calId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    };
    const eventsPayload: any = await mcpCallTool(eventsTool.name, args);
    console.error(`[MCP] raw events payload for ${calId}:`, JSON.stringify(eventsPayload).slice(0, 600));

    // Composio shapes we’ve seen:
    // { successfull, error, data: { items: [...] } }
    // or { items: [...] } or [...]
    const events: RawEvent[] =
      eventsPayload?.data?.items ??
      eventsPayload?.items ??
      (Array.isArray(eventsPayload) ? (eventsPayload as RawEvent[]) : []) ??
      [];

    if (Array.isArray(events)) allEvents = allEvents.concat(events);
  }

  return splitUpcomingPast(allEvents);
}
