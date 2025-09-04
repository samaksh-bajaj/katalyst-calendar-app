'use client';

import { useState, useTransition } from 'react';
import { initiateComposioGoogleCalendar, checkComposioConnection } from '@/app/actions';

export default function ConnectCalendar() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  async function onConnect() {
    startTransition(async () => {
      const url = await initiateComposioGoogleCalendar();
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Could not get connect URL. Check MCP config and logs.');
      }
    });
  }

  async function onCheck() {
    startTransition(async () => {
      const ok = await checkComposioConnection();
      setStatus(ok ? 'connected' : 'disconnected');
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onConnect}
        disabled={pending}
        className="rounded-2xl border px-3 py-1 text-sm hover:shadow disabled:opacity-50"
      >
        {pending ? 'Opening…' : 'Connect Google Calendar'}
      </button>
      <button
        onClick={onCheck}
        disabled={pending}
        className="rounded-2xl border px-3 py-1 text-sm hover:shadow disabled:opacity-50"
      >
        Check Status
      </button>
      {status !== 'unknown' && (
        <span className="text-sm">
          {status === 'connected' ? '✅ Connected' : '⚠️ Not connected'}
        </span>
      )}
    </div>
  );
}
