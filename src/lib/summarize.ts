import type { Meeting } from "@/types";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function summarizePastMeeting(m: Meeting): Promise<string> {
  if (!OPENAI_API_KEY) {
    return `Discussion of "${m.title}" with ${m.attendees.length} attendee(s). Key outcomes pending.`;
  }
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "content-type":"application/json","authorization":`Bearer ${OPENAI_API_KEY}`},
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role:"user",
          content: `Summarize in 2–3 sentences:\nTitle: ${m.title}\nTime: ${m.start}–${m.end}\nAttendees: ${m.attendees.map(a=>a.displayName??a.email).join(", ") || "unknown"}\nDescription:\n${m.description ?? "(none)"}`
        }],
        temperature: 0.3,
      })
    });
    if (!resp.ok) return "Summary unavailable.";
    const json = await resp.json();
    return json.choices?.[0]?.message?.content?.trim() ?? "Summary unavailable.";
  } catch {
    return "Summary unavailable.";
  }
}

export async function maybeSummarizePast(meetings: Meeting[]) {
  const past = await Promise.all(meetings.map(async m => {
    if (!m.isPast) return m;
    return { ...m, summary: await summarizePastMeeting(m) };
  }));
  return past;
}
