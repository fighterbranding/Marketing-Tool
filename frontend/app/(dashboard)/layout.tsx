'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { NavBar } from '@/components/nav-bar';

// localStorage is an external store; the 'storage' event also catches
// sign-out from another tab
function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authed = useSyncExternalStore(
    subscribeToStorage,
    () => localStorage.getItem('token') !== null,
    () => false
  );

  // getServerSnapshot() above always returns false (no localStorage on the
  // server), so on a hard navigation the very first client render still
  // reflects that SSR-matched snapshot. Gate the redirect on having
  // completed a mount cycle so we never redirect off that transient
  // false-negative before useSyncExternalStore's hydration correction lands.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    if (hasMounted && !authed) router.replace('/login');
  }, [hasMounted, authed, router]);

  // Render nothing until the token check passes — avoids flashing protected
  // UI and firing unauthenticated API requests before the redirect lands
  if (!hasMounted || !authed) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Suspense fallback={<div className="h-14 bg-white border-b border-gray-200" />}>
        <NavBar />
      </Suspense>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
