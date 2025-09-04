// src/app/page.tsx
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listUserEvents } from "@/lib/googleCalendar";
import { toDurationMins } from "@/lib/time";
import MeetingCard from "@/components/MeetingCard";

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
      start, end,
      durationMins: toDurationMins(start, end),
      attendees: (e.attendees ?? []).map((a: any) => ({
        email: a.email,
        displayName: a.displayName,
        response: a.responseStatus,
      })),
      description: e.description,
      // If you already generate summaries elsewhere, pass them in here:
      aiSummary: undefined as string | undefined,
      isPast: +new Date(end) < now,
    };
  };

  const mapped = events.map(normalize).filter(Boolean) as any[];
  const upcoming = mapped.filter(m => !m.isPast).slice(0, 5);
  const past = mapped.filter(m => m.isPast).sort((a, b) => +new Date(b.end) - +new Date(a.end)).slice(0, 5);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalyst Calendar</h1>
        <a className="text-sm underline" href="/api/auth/signout">Sign out</a>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming */}
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Upcoming (next 5)</h2>
          {upcoming.length ? (
            upcoming.map((m: any) => (
              <MeetingCard
                key={m.id}
                title={m.title}
                start={m.start}
                end={m.end}
                durationMins={m.durationMins}
                attendees={m.attendees}
                description={m.description}
                aiSummary={m.aiSummary}
              />
            ))
          ) : (
            <div className="text-sm text-gray-600">No upcoming meetings.</div>
          )}
        </section>

        {/* Past */}
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Past (last 5)</h2>
          {past.length ? (
            past.map((m: any) => (
              <MeetingCard
                key={m.id}
                title={m.title}
                start={m.start}
                end={m.end}
                durationMins={m.durationMins}
                attendees={m.attendees}
                description={m.description}
                aiSummary={m.aiSummary}
              />
            ))
          ) : (
            <div className="text-sm text-gray-600">No past meetings.</div>
          )}
        </section>
      </div>
    </main>
  );
}
