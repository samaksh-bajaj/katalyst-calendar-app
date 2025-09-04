// src/components/MeetingCard.tsx
import * as React from "react";

type Attendee = { email: string; displayName?: string; response?: string };

export default function MeetingCard({
  title,
  start,
  end,
  durationMins,
  attendees = [],
  description,
  aiSummary,
}: {
  title: string;
  start: string;
  end: string;
  durationMins: number;
  attendees?: Attendee[];
  description?: string;
  aiSummary?: string;
}) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm hover:shadow transition">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-gray-600">
        {fmt(start)} → {fmt(end)} · {durationMins} min
      </div>

      {attendees.length > 0 && (
        <div className="mt-2 text-xs text-gray-700">
          <span className="font-medium">Attendees:</span>{" "}
          {attendees.map(a => a.displayName || a.email).join(", ")}
        </div>
      )}

      {description && (
        <p className="mt-2 text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">
          {description}
        </p>
      )}

      {aiSummary && (
        <div className="mt-3 rounded-xl border bg-gray-50 p-3">
          <div className="text-[10px] font-semibold tracking-wide text-gray-500">
            AI SUMMARY
          </div>
          <div className="text-xs text-gray-800">{aiSummary}</div>
        </div>
      )}
    </div>
  );
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
