import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/session';
import { listTokens, usedTodayAll } from '@/lib/tokens';
import { logout, revoke } from './actions';
import { CreateToken } from './CreateToken';
import { Mark } from './Mark';

export const dynamic = 'force-dynamic';

const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Section({ number, label, children }: { number: string; label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px]">
      <h2 className="flex items-center gap-2.5 border-b border-edge pb-3 font-mono text-[11px] font-normal">
        <span className="text-accent">{number}</span>
        <span className="tracking-[0.08em] text-subtle">{label}</span>
      </h2>
      {children}
    </section>
  );
}

export default async function Dashboard() {
  if (!(await isAdmin())) redirect('/login');
  const db = await getDb();
  const [tokens, usedToday] = await Promise.all([listTokens(db), usedTodayAll(db)]);
  const cap = Number(process.env.GLOBAL_DAILY_LIMIT) || 200;
  const keyReady = Boolean(process.env.ANTHROPIC_API_KEY);
  const now = Date.now();

  return (
    <div>
      <header className="flex h-[60px] items-center justify-between border-b border-edge px-8 max-sm:px-4">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-medium">Askwell</span>
          <span className="text-sm text-subtle">/</span>
          <span className="text-sm text-muted">Admin tokens</span>
        </div>
        <form action={logout}>
          <button type="submit" className="cursor-pointer text-[13px] text-subtle hover:text-ink">
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-12 px-4 pt-14 pb-16">
        <h1 className="text-[40px] leading-tight font-medium tracking-tight">
          Admin tokens. <span className="text-faint">Your key, their Improve.</span>
        </h1>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-edge max-sm:grid-cols-1">
          <div className="flex flex-col gap-0.5 p-4">
            <span className="text-[28px] font-medium tracking-tight">{tokens.filter((t) => !t.revoked_at).length}</span>
            <span className="text-xs text-muted">active tokens</span>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-edge p-4 max-sm:border-t max-sm:border-l-0">
            <span className="text-[28px] font-medium tracking-tight">
              {usedToday} <span className="text-[15px] text-subtle">/ {cap}</span>
            </span>
            <span className="text-xs text-muted">rewrites today, all tokens</span>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-edge p-4 max-sm:border-t max-sm:border-l-0">
            <span className={`text-[15px] font-medium ${keyReady ? '' : 'text-danger'}`}>{keyReady ? 'Ready' : 'No key set'}</span>
            <span className="text-xs text-muted">{keyReady ? `Anthropic · ${process.env.PORTAL_MODEL || 'claude-opus-5-5'}` : 'Set ANTHROPIC_API_KEY'}</span>
          </div>
        </div>

        <Section number="01" label="NEW TOKEN">
          <CreateToken />
        </Section>

        <Section number="02" label="TOKENS">
          {tokens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-edge p-4 text-[13px] text-subtle">No tokens yet.</p>
          ) : (
            <ul className="flex flex-col rounded-xl border border-edge">
              {tokens.map((t) => {
                const expired = t.expires_at !== null && new Date(t.expires_at).getTime() <= now;
                const state = t.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Active';
                return (
                  <li key={t.id} className={`flex items-center justify-between gap-4 px-4 py-3.5 [&+&]:border-t [&+&]:border-edge ${state === 'Active' ? '' : 'opacity-55'}`}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm">
                        {t.label}
                        <span className="font-mono text-[10.5px] tracking-[0.06em] text-subtle uppercase">{state}</span>
                      </span>
                      <span className="font-mono text-[12px] text-subtle">
                        {t.prefix}… · {t.used_today}/{t.daily_limit} today · expires {date(t.expires_at)} · last used {date(t.last_used_at)}
                      </span>
                    </div>
                    {state === 'Active' && (
                      <form action={revoke}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="h-8 cursor-pointer rounded-lg border border-edge px-3 text-[13px] text-danger hover:bg-raised">
                          Revoke
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <p className="border-t border-edge pt-6 text-[12.5px] leading-relaxed text-subtle">
          Token holders paste the token into Preflight’s settings under <b>Admin token</b>. Their rewrites run on your key, at
          most their daily limit, and never more than {cap} a day across everyone. Tokens are stored only as hashes.
        </p>
      </main>
    </div>
  );
}
