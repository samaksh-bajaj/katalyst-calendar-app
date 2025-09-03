"use client";
import { useEffect, useState } from "react";
import Section from "@/components/Section";
import MeetingCard from "@/components/MeetingCard";
import Skeleton from "@/components/Skeleton";
type Meeting = import("@/types").Meeting;
type Payload = { upcoming: Meeting[]; past: Meeting[] };

export default function Home() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/meetings");
        if (!res.ok) {
          const j = await res.json().catch(()=>({error:"Failed"}));
          throw new Error(j.error ?? "Failed");
        }
        const j: Payload = await res.json();
        setData(j);
      } catch (e: any) {
        setErr(e?.message ?? "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Katalyst Calendar</h1>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_,i)=><Skeleton key={i}/>)}
        </div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Katalyst Calendar</h1>
        <div className="rounded-2xl border p-4 bg-red-50 border-red-200">
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-sm text-red-800">{err}</p>
        </div>
        <a className="underline text-sm" href="/login">Try signing in</a>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalyst Calendar</h1>
        <a className="text-sm underline" href="/login">Switch user</a>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Section title="Upcoming (next 5)">
            {data?.upcoming?.length ? data.upcoming.map(m => <MeetingCard key={m.id} m={m} />) : <p className="text-sm text-gray-600">No upcoming meetings.</p>}
          </Section>
        </div>
        <div>
          <Section title="Past (latest 5)">
            {data?.past?.length ? data.past.map(m => <MeetingCard key={m.id} m={m} />) : <p className="text-sm text-gray-600">No past meetings.</p>}
          </Section>
        </div>
      </div>
    </main>
  );
}
