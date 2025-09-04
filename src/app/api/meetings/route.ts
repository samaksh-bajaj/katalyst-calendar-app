// src/app/api/meetings/route.ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { listUserEvents } from "@/lib/googleCalendar";
import { toDurationMins } from "@/lib/time";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await listUserEvents(user.accessToken);
    const now = Date.now();

    const normalize = (e: any) => {
      const start = e?.start?.dateTime ?? (e?.start?.date ? `${e.start.date}T00:00:00Z` : null);
      const end = e?.end?.dateTime ?? (e?.end?.date ? `${e.end.date}T00:00:00Z` : null);
      if (!start || !end) return null;
      return {
        id: e.id,
        title: e.summary ?? "(No title)",
        start,
        end,
        durationMins: toDurationMins(start, end),
        attendees: (e.attendees ?? []).map((a: any) => ({
          email: a.email,
          displayName: a.displayName,
          response: a.responseStatus,
        })),
        description: e.description,
      };
    };

    const mapped = events.map(normalize).filter(Boolean) as any[];
    const upcoming = mapped.filter(m => +new Date(m.end) >= now).slice(0, 5);
    const past = mapped
      .filter(m => +new Date(m.end) < now)
      .sort((a, b) => +new Date(b.end) - +new Date(a.end))
      .slice(0, 5);

    return NextResponse.json({ upcoming, past });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}
