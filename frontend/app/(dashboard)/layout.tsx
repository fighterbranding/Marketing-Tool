'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { NavBar } from '@/components/nav-bar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Suspense fallback={<div className="h-14 bg-white border-b border-gray-200" />}>
        <NavBar />
      </Suspense>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
