import { toDurationMins } from "./time";
import type { Meeting } from "@/types";
import { headers } from "next/headers";

// Build an absolute URL from a relative path (works on localhost and Vercel)
function absoluteUrl(path: string) {
  if (path.startsWith("http")) return path;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

const endpoint = "/api/mcp"; // internal MCP mock endpoint

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

export async function fetchMeetingsViaMCP() {
  const res = await fetch(absoluteUrl(endpoint), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "gcal-list",
      method: "google_calendar.listEvents",
      params: { maxUpcoming: 5, maxPast: 5 },
    }),
  });

  if (!res.ok) throw new Error(`MCP server error ${res.status}`);
  const data = await res.json();
  const raw: RawEvent[] = data.result?.events ?? [];
  const mapped = raw.map(e => normalize(e)).filter(Boolean) as Meeting[];
  const now = Date.now();
  const upcoming = mapped.filter(m => +new Date(m.end) >= now).slice(0, 5);
  const past = mapped
    .filter(m => +new Date(m.end) < now)
    .sort((a,b)=>+new Date(b.end)-+new Date(a.end))
    .slice(0,5);
  return { upcoming, past };
}
