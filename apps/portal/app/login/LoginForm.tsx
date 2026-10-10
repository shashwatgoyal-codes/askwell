'use client';

import { useActionState } from 'react';
import { login } from '../actions';

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="password" className="text-[13px] text-label">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className="h-[42px] rounded-lg border border-edge bg-surface px-3.5 text-[14px] outline-none focus:border-subtle"
      />
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-[42px] cursor-pointer rounded-lg bg-accent text-[14px] font-medium text-on-accent disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
