import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isoPlusMinutes(mins: number) {
  return new Date(Date.now() + mins*60000).toISOString();
}
function isoMinusMinutes(mins: number) {
  return new Date(Date.now() - mins*60000).toISOString();
}

export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const id = body?.id ?? null;
  const method = body?.method ?? "";

  if (method !== "google_calendar.listEvents") {
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
  }

  const attendees = [{ email: "alex@example.com", displayName: "Alex Doe", responseStatus: "accepted" }];
  const events = [
    // Upcoming
    { id:"u1", summary:"Standup", start:{dateTime: isoPlusMinutes(30)}, end:{dateTime: isoPlusMinutes(60)}, attendees, description:"Daily sync" },
    { id:"u2", summary:"1:1", start:{dateTime: isoPlusMinutes(90)}, end:{dateTime: isoPlusMinutes(120)}, attendees, description:"Career chat" },
    { id:"u3", summary:"Design Review", start:{dateTime: isoPlusMinutes(180)}, end:{dateTime: isoPlusMinutes(240)}, attendees, description:"UI pass" },
    { id:"u4", summary:"Sprint Planning", start:{dateTime: isoPlusMinutes(300)}, end:{dateTime: isoPlusMinutes(360)}, attendees, description:"Backlog" },
    { id:"u5", summary:"Customer Call", start:{dateTime: isoPlusMinutes(420)}, end:{dateTime: isoPlusMinutes(480)}, attendees, description:"Demo" },
    // Past
    { id:"p1", summary:"Retro", start:{dateTime: isoMinusMinutes(60)}, end:{dateTime: isoMinusMinutes(30)}, attendees, description:"What went well" },
    { id:"p2", summary:"Hiring Sync", start:{dateTime: isoMinusMinutes(120)}, end:{dateTime: isoMinusMinutes(90)}, attendees, description:"Pipeline" },
    { id:"p3", summary:"Ops Review", start:{dateTime: isoMinusMinutes(240)}, end:{dateTime: isoMinusMinutes(210)}, attendees, description:"Incidents" },
    { id:"p4", summary:"Roadmap", start:{dateTime: isoMinusMinutes(360)}, end:{dateTime: isoMinusMinutes(330)}, attendees, description:"Q4 plans" },
    { id:"p5", summary:"Partner Check-in", start:{dateTime: isoMinusMinutes(480)}, end:{dateTime: isoMinusMinutes(450)}, attendees, description:"Joint GTM" },
  ];

  return NextResponse.json({ jsonrpc: "2.0", id, result: { events } });
}
