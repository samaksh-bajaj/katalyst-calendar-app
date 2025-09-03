import type { Meeting } from "@/types";
import clsx from "clsx";

export default function MeetingCard({ m }: { m: Meeting }) {
  const start = new Date(m.start).toLocaleString();
  const end   = new Date(m.end).toLocaleString();
  return (
    <article className={clsx("rounded-2xl border p-4 shadow-sm hover:shadow transition")}>
      <h3 className="font-medium">{m.title}</h3>
      <p className="text-sm text-gray-600">{start} → {end} • {m.durationMins} min</p>
      {m.attendees?.length > 0 && (
        <p className="text-sm mt-1">
          <span className="text-gray-500">Attendees:</span>{" "}
          {m.attendees.slice(0,4).map(a => a.displayName ?? a.email).join(", ")}
          {m.attendees.length > 4 ? ` +${m.attendees.length - 4}` : ""}
        </p>
      )}
      {m.description && <p className="text-sm mt-2 line-clamp-3">{m.description}</p>}
      {m.isPast && m.summary && (
        <div className="mt-3 rounded-xl border p-3 bg-gray-50">
          <p className="text-xs uppercase tracking-wide text-gray-500">AI Summary</p>
          <p className="text-sm mt-1">{m.summary}</p>
        </div>
      )}
    </article>
  );
}
