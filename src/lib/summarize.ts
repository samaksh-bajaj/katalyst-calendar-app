// src/lib/summarize.ts
type Attendee = { email: string; displayName?: string; response?: string };

export type NormalizedMeeting = {
  id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  durationMins: number;
  attendees: Attendee[];
  description?: string;
};

/**
 * Summarize a single meeting with OpenAI.
 * Keeps the output short (2–3 bullets). If description is missing, uses title/attendees.
 */
export async function summarizeMeeting(m: NormalizedMeeting): Promise<string | undefined> {
  try {
    const body = {
      model: "gpt-4o-mini", // small + fast; change if you prefer
      messages: [
        {
          role: "system",
          content:
            "You write concise meeting summaries for internal calendars. Output 2–3 short bullet points. Avoid fluff.",
        },
        {
          role: "user",
          content: [
            "Summarize this meeting for a stand-alone card.",
            "",
            `Title: ${m.title}`,
            `Start: ${m.start}`,
            `End: ${m.end}`,
            `Duration: ${m.durationMins} minutes`,
            `Attendees: ${m.attendees.map(a => a.displayName || a.email).join(", ") || "N/A"}`,
            `Notes/Description: ${truncate(clean(m.description || ""), 1500) || "N/A"}`,
          ].join("\n"),
        },
      ],
      temperature: 0.3,
      max_tokens: 160,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return undefined;
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    return text?.trim();
  } catch {
    return undefined;
  }
}

/** Summarize up to N meetings in parallel, return a map id -> summary */
export async function summarizeMany(meetings: NormalizedMeeting[], limit = 5) {
  const slice = meetings.slice(0, limit);
  const results = await Promise.allSettled(slice.map(summarizeMeeting));
  const map: Record<string, string> = {};
  results.forEach((r, i) => {
    const m = slice[i];
    if (r.status === "fulfilled" && r.value) map[m.id] = r.value;
  });
  return map;
}

function clean(s: string) {
  // Strip HTML tags / excessive whitespace
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
