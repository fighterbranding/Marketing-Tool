'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ConnectionStatus = 'ACTIVE' | 'NEEDS_RECONNECT' | 'NEVER_CONNECTED';

export default function ConnectMetaPage() {
  const [status, setStatus] = useState<ConnectionStatus>('NEVER_CONNECTED');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    api.get('/auth/meta/status').then(({ data }) => setStatus(data.status)).catch(() => {});
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      // A short-lived, single-use ticket — not the session token itself —
      // is what travels in the URL for this plain-navigation redirect.
      const { data } = await api.post<{ ticket: string }>('/auth/meta/connect/ticket');
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/meta/connect?ticket=${encodeURIComponent(data.ticket)}`;
    } catch {
      setConnecting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Connect your Meta account</h1>

        {status === 'ACTIVE' && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg px-4 py-3 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Connected
          </div>
        )}

        {status === 'NEEDS_RECONNECT' && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg px-4 py-3 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Connection expired — please reconnect
          </div>
        )}

        <p className="text-sm text-gray-600">
          Link your Meta Business account to start pulling ad analytics and managing campaigns.
        </p>

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          {connecting
            ? 'Connecting…'
            : status === 'ACTIVE'
              ? 'Reconnect Meta account'
              : 'Connect Meta account'}
        </button>
      </div>
    </main>
  );
}
