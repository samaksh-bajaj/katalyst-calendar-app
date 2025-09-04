'use server';

export async function listMcpTools() {
  const res = await fetch(process.env.NEXT_PUBLIC_MCP_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "tools/list", params: {} }),
    cache: "no-store",
  });

  const text = await res.text();
  console.error("[Tools/list raw]:", text.slice(0, 500));
  return text;
}

// Uses the public MCP URL so this works both locally and on Vercel
const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL!;
const HEADERS = {
  'content-type': 'application/json',
  // Composio can stream responses via SSE
  accept: 'application/json, text/event-stream',
};

// Minimal SSE-aware JSON-RPC call to MCP (safe)
async function mcpCall(method: string, params: any) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
    cache: 'no-store',
  });
  const text = await res.text();

  // SSE format: "event: message\n data: {...}"
  if (text.startsWith('event:')) {
    const dataLines = text
      .split('\n')
      .filter((l) => l.trim().startsWith('data:'))
      .map((l) => l.replace(/^data:\s*/, '').trim());
    if (!dataLines.length) return null;
    try {
      const json = JSON.parse(dataLines[dataLines.length - 1] || '{}');
      return json?.result ?? null;
    } catch {
      return null;
    }
  }

  // Plain JSON
  try {
    const json = JSON.parse(text || '{}');
    return json?.result ?? null;
  } catch {
    return null;
  }
}

// Some Composio servers wrap JSON as text blocks in `result.content[].text`
function unpackResult(result: any) {
  if (result && Array.isArray(result.content)) {
    const lastText = [...result.content]
      .reverse()
      .find((c: any) => typeof c?.text === 'string')?.text;
    if (lastText) {
      try {
        return JSON.parse(lastText);
      } catch {
        return result;
      }
    }
  }
  return result;
}

/**
 * Starts Composio's hosted OAuth connection for Google Calendar.
 * Returns a URL to open in a new tab.
 */
export async function initiateComposioGoogleCalendar(): Promise<string | null> {
  const raw = await mcpCall('tools/call', {
    name: 'COMPOSIO_INITIATE_CONNECTION',
    arguments: {
      provider: 'googlecalendar',
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      return_url: true,
    },
  });

  console.error("[Connect] raw initiate result:", JSON.stringify(raw).slice(0, 500));

  const payload = unpackResult(raw);
  console.error("[Connect] unpacked payload:", JSON.stringify(payload).slice(0, 500));

  if (payload?.url && typeof payload.url === 'string') return payload.url;
  if (payload?.data?.url && typeof payload.data.url === 'string') return payload.data.url;

  if (raw?.content && Array.isArray(raw.content)) {
    const txt = raw.content.find((c: any) => typeof c?.text === 'string')?.text;
    if (txt) {
      try {
        const parsed = JSON.parse(txt);
        console.error("[Connect] parsed text payload:", parsed);
        if (typeof parsed?.url === 'string') return parsed.url;
        if (typeof parsed?.data?.url === 'string') return parsed.data.url;
      } catch (e) {
        console.error("[Connect] failed to parse text:", e);
      }
    }
  }
  return null;
}


/**
 * Checks if Google Calendar is connected in Composio (for the current user/context).
 * Returns true/false.
 */
export async function checkComposioConnection(): Promise<boolean> {
  const raw = await mcpCall('tools/call', {
    name: 'COMPOSIO_CHECK_ACTIVE_CONNECTION',
    arguments: { provider: 'googlecalendar' },
  });
  const payload = unpackResult(raw);

  // Try common shapes
  if (typeof payload?.connected === 'boolean') return payload.connected;
  if (typeof payload?.success === 'boolean') return payload.success;
  if (typeof payload?.data?.connected === 'boolean') return payload.data.connected;

  // Some servers return { content: [{ text: "{\"connected\": true}" }]}
  if (raw?.content && Array.isArray(raw.content)) {
    const txt = raw.content.find((c: any) => typeof c?.text === 'string')?.text;
    if (txt) {
      try {
        const parsed = JSON.parse(txt);
        if (typeof parsed?.connected === 'boolean') return parsed.connected;
        if (typeof parsed?.success === 'boolean') return parsed.success;
        if (typeof parsed?.data?.connected === 'boolean') return parsed.data.connected;
      } catch { /* ignore */ }
    }
  }

  return false;
}
