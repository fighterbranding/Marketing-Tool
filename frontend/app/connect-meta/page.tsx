'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ConnectionStatus = 'ACTIVE' | 'NEEDS_RECONNECT' | 'NEVER_CONNECTED';

export default function ConnectMetaPage() {
  const [status, setStatus] = useState<ConnectionStatus>('NEVER_CONNECTED');

  useEffect(() => {
    api.get('/auth/meta/status').then(({ data }) => setStatus(data.status)).catch(() => {});
  }, []);

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

        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/auth/meta/connect`}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {status === 'ACTIVE' ? 'Reconnect Meta account' : 'Connect Meta account'}
        </a>
      </div>
    </main>
  );
}
