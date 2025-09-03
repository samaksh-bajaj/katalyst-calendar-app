import Section from "@/components/Section";
import MeetingCard from "@/components/MeetingCard";
import { fetchMeetingsViaMCP } from "@/lib/mcp";
import { maybeSummarizePast } from "@/lib/summarize";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = getUser();
  if (!user) redirect("/login");

  const { upcoming, past } = await fetchMeetingsViaMCP();
  const pastSummarized = await maybeSummarizePast(past);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalyst Calendar</h1>
        <a className="text-sm underline" href="/login">Switch user</a>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Section title="Upcoming (next 5)">
            {upcoming.length
              ? upcoming.map(m => <MeetingCard key={m.id} m={m} />)
              : <p className="text-sm text-gray-600">No upcoming meetings.</p>}
          </Section>
        </div>
        <div>
          <Section title="Past (latest 5)">
            {pastSummarized.length
              ? pastSummarized.map(m => <MeetingCard key={m.id} m={m} />)
              : <p className="text-sm text-gray-600">No past meetings.</p>}
          </Section>
        </div>
      </div>
    </main>
  );
}
