import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listUserEvents } from "@/lib/googleCalendar";
import { toDurationMins } from "@/lib/time";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

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
      isPast: +new Date(end) < now,
    };
  };

  const mapped = events.map(normalize).filter(Boolean) as any[];
  const upcoming = mapped.filter(m => +new Date(m.end) >= now).slice(0, 5);
  const past = mapped
    .filter(m => +new Date(m.end) < now)
    .sort((a, b) => +new Date(b.end) - +new Date(a.end))
    .slice(0, 5);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalyst Calendar</h1>
        <a className="text-sm underline" href="/api/auth/signout">Sign out</a>
      </header>

      <section>
        <h2 className="text-xl font-medium mb-2">Upcoming (next 5)</h2>
        <div className="space-y-2">
          {upcoming.length ? upcoming.map((m: any) => (
            <div key={m.id} className="border rounded-xl p-3">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm opacity-70">{m.start} → {m.end} · {m.durationMins} mins</div>
              {m.attendees?.length ? <div className="text-xs mt-1">Attendees: {m.attendees.map((a:any)=>a.email).join(", ")}</div> : null}
              {m.description ? <p className="text-xs mt-1">{m.description}</p> : null}
            </div>
          )) : <div className="text-sm opacity-70">No upcoming meetings.</div>}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-2">Past (last 5)</h2>
        <div className="space-y-2">
          {past.length ? past.map((m: any) => (
            <div key={m.id} className="border rounded-xl p-3">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm opacity-70">{m.start} → {m.end} · {m.durationMins} mins</div>
              {m.attendees?.length ? <div className="text-xs mt-1">Attendees: {m.attendees.map((a:any)=>a.email).join(", ")}</div> : null}
              {m.description ? <p className="text-xs mt-1">{m.description}</p> : null}
            </div>
          )) : <div className="text-sm opacity-70">No past meetings.</div>}
        </div>
      </section>
    </main>
  );
}
