import { toDurationMins } from "./time";
import type { Meeting } from "@/types";
import { headers } from "next/headers";

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

async function mcp(method: string, params: any) {
  const res = await fetch(target, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("MCP HTTP error", res.status, t);
    throw new Error(`MCP server error ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    console.error("MCP JSON-RPC error", json.error);
    throw new Error(json.error.message || "MCP JSON-RPC error");
  }
  return json.result;
}

async function mcpInitialize() {
  await mcp("initialize", {
    protocolVersion: "2025-03-26",
    clientInfo: { name: "katalyst-calendar-app", version: "1.0.0" },
    capabilities: {},
  });
}

async function mcpListTools() {
  const result = await mcp("tools/list", {});
  return Array.isArray(result) ? result : result?.tools ?? [];
}

function pickListEventsTool(tools: any[]) {
  return tools.find(
    (t) => t?.name?.toLowerCase?.().includes("list") && t?.name?.toLowerCase?.().includes("event")
  );
}

async function mcpCallTool(name: string, args: Record<string, any>) {
  return mcp("tools/call", { name, arguments: args });
}

type RawEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  description?: string;
};

function normalize(raw: RawEvent, now = new Date()) {
  const start = raw.start?.dateTime ?? (raw.start?.date ? `${raw.start.date}T00:00:00Z` : null);
  const end = raw.end?.dateTime ?? (raw.end?.date ? `${raw.end.date}T00:00:00Z` : null);
  if (!start || !end) return null;
  const isPast = new Date(end).getTime() < now.getTime();
  return {
    id: raw.id,
    title: raw.summary ?? "(No title)",
    start, end,
    durationMins: toDurationMins(start, end),
    attendees: (raw.attendees ?? []).map((a) => ({
      email: a.email,
      displayName: a.displayName,
      response: a.responseStatus,
    })),
    description: raw.description,
    isPast,
  };
}

function splitUpcomingPast(events: RawEvent[]) {
  const mapped = events.map((e) => normalize(e)).filter(Boolean) as any[];
  const now = Date.now();
  return {
    upcoming: mapped.filter((m) => +new Date(m.end) >= now).slice(0, 5),
    past: mapped
      .filter((m) => +new Date(m.end) < now)
      .sort((a, b) => +new Date(b.end) - +new Date(a.end))
      .slice(0, 5),
  };
}

export async function fetchMeetingsViaMCP() {
  // Fallback to internal mock if no Composio URL set
  if (!process.env.NEXT_PUBLIC_MCP_URL) {
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
    if (!res.ok) throw new Error(`MCP server error ${res.status}`);
    const data = await res.json();
    return splitUpcomingPast(data.result?.events ?? []);
  }

  // Real MCP flow (Composio)
  await mcpInitialize();

  const tools = await mcpListTools();
  const tool = pickListEventsTool(tools);
  if (!tool) throw new Error("Could not find a 'List Events' tool on the MCP server.");

  const now = new Date();
  const args = {
    calendarId: "primary",
    timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  };

  const result = await mcpCallTool(tool.name, args);
  const events: RawEvent[] =
    result?.events ?? result?.content?.events ?? result?.content ?? result ?? [];
  return splitUpcomingPast(events);
}
