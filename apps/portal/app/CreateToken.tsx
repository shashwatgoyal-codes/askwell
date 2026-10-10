'use client';

import { useActionState, useState } from 'react';
import { create, type CreateState } from './actions';

const input = 'h-[42px] w-full rounded-lg border border-edge bg-surface px-3.5 text-[14px] outline-none focus:border-subtle';

export function CreateToken() {
  const [state, action, pending] = useActionState<CreateState, FormData>(create, null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid grid-cols-[1fr_140px_140px_auto] items-end gap-3 max-sm:grid-cols-1">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="label" className="text-[13px] text-label">Who it’s for</label>
          <input id="label" name="label" required maxLength={60} placeholder="Rahul, testing" className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dailyLimit" className="text-[13px] text-label">Rewrites per day</label>
          <input id="dailyLimit" name="dailyLimit" type="number" min={1} max={500} defaultValue={20} className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expiresInDays" className="text-[13px] text-label">Expires in days</label>
          <input id="expiresInDays" name="expiresInDays" type="number" min={0} max={365} defaultValue={30} className={input} />
        </div>
        <button type="submit" disabled={pending} className="h-[42px] cursor-pointer rounded-lg bg-accent px-4 text-[14px] font-medium text-on-accent disabled:opacity-60">
          {pending ? 'Creating…' : 'Create token'}
        </button>
      </form>
      <p className="text-[12.5px] text-subtle">0 days means it never expires. You can revoke any token at any time.</p>
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
      {state?.token && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/50 bg-wash p-4">
          <span className="text-[13px]">
            Token for <b>{state.label}</b>. Copy it now: it is shown <b>once</b> and can’t be seen again.
          </span>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-lg border border-edge bg-surface px-3 py-2.5 font-mono text-[13px]" data-testid="new-token">
              {state.token}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(state.token!).then(() => setCopied(true))}
              className="cursor-pointer rounded-lg border border-edge px-3 text-[13px] hover:bg-raised"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
