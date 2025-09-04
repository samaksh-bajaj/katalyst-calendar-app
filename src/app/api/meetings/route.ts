import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { fetchMeetingsViaMCP } from "@/lib/mcp";
// import { maybeSummarizePast } from "@/lib/summarize";

export const runtime = "nodejs";

export async function GET() {
  const user = getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const { upcoming, past } = await fetchMeetingsViaMCP();
    const pastSummarized = await maybeSummarizePast(past);
    return NextResponse.json({ upcoming, past: pastSummarized });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
