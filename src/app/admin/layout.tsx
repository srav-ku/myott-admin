'use client';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Film, 
  LogOut,
  Loader2,
  Search
} from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, isAdmin, loading, router]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg text-white">
        <Loader2 className="animate-spin text-brand" size={40} />
      </div>
    );
  }

  const navItems = [
    { label: 'Library', href: '/admin?source=local', icon: Film },
    { label: 'Discovery', href: '/admin?source=tmdb', icon: Search },
  ];

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* Top Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-surface sticky top-0 z-50">
        <Link href="/admin" className="font-bold text-lg tracking-tight whitespace-nowrap">
          MyOTT <span className="text-brand">Admin</span>
        </Link>

        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
          title="Sign Out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </header>

      {/* Secondary Navigation */}
      <div className="sticky top-14 z-40 bg-bg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <nav className="flex items-center gap-1 py-3">
            {navItems.map((item) => {
              let active = false;
              if (item.label === 'Library') {
                active = (pathname === '/admin' || pathname.startsWith('/admin/manage/')) && searchParams.get('source') !== 'tmdb';
              } else if (item.label === 'Discovery') {
                active = pathname === '/admin' && searchParams.get('source') === 'tmdb';
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    active
                      ? 'bg-brand text-white'
                      : 'text-text-dim hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
        {children}
      </main>
    </div>
  );
}
