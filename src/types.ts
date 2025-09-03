export type Attendee = { email: string; displayName?: string; response?: string };
export type Meeting = {
  id: string;
  title: string;
  start: string;    // ISO
  end: string;      // ISO
  durationMins: number;
  attendees: Attendee[];
  description?: string;
  isPast: boolean;
  summary?: string; // optional AI
};

export type MeetingsPayload = {
  upcoming: Meeting[];
  past: Meeting[];
};
