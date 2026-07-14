'use client';
import { useEffect, useSyncExternalStore } from 'react';
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

  useEffect(() => {
    if (!authed) router.replace('/login');
  }, [authed, router]);

  // Render nothing until the token check passes — avoids flashing protected
  // UI and firing unauthenticated API requests before the redirect lands
  if (!authed) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Suspense fallback={<div className="h-14 bg-white border-b border-gray-200" />}>
        <NavBar />
      </Suspense>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
