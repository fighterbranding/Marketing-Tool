import Link from 'next/link';

export default function ConnectMetaSuccess() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-4 text-center">
        <div className="text-4xl">✓</div>
        <h1 className="text-xl font-bold text-gray-900">Meta account connected</h1>
        <p className="text-sm text-gray-500">Your ad accounts and pages are now linked.</p>
        <Link
          href="/dashboard"
          className="inline-block w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
