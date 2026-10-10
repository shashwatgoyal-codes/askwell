import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/session';
import { Mark } from '../Mark';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await isAdmin()) redirect('/');
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      {/* A faint grid and one soft glow, so the card sits on something rather than nothing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--color-edge)_1px,transparent_1px),linear-gradient(90deg,var(--color-edge)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-[62%] rounded-full bg-accent opacity-[0.07] blur-[110px]"
      />

      <div className="relative flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex flex-col gap-7 rounded-[18px] border border-edge bg-surface/90 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm max-sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mark size={28} />
              <span className="text-[15px] font-medium">Askwell</span>
            </div>
            <span className="rounded-md border border-edge px-2 py-1 font-mono text-[10.5px] tracking-[0.1em] text-subtle">PORTAL</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] leading-tight font-medium tracking-tight">Welcome back.</h1>
            <p className="text-[14px] leading-relaxed text-muted">
              Sign in to decide who can use Improve on your key, and how much.
            </p>
          </div>

          <LoginForm />
        </div>

        <p className="flex items-center justify-center gap-2 font-mono text-[11px] text-subtle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Owner only · tokens are stored as hashes
        </p>
      </div>
    </main>
  );
}
