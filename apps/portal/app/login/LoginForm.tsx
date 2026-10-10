'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { login } from '../actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const error = state?.error;
  const passwordRef = useRef<HTMLInputElement>(null);
  // After a refused attempt the email is kept, so the next thing to type is the password.
  useEffect(() => {
    if (state) passwordRef.current?.focus();
  }, [state]);
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] text-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus={!state}
          defaultValue={state?.email}
          key={state?.email}
          autoComplete="username"
          aria-invalid={Boolean(error)}
          className={`h-11 w-full rounded-lg border bg-canvas/60 px-3.5 text-[14px] outline-none transition-colors focus:border-subtle ${
            error ? 'border-danger/70' : 'border-edge'
          }`}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-[13px] text-label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={visible ? 'text' : 'password'}
            ref={passwordRef}
            required
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'password-error' : undefined}
            className={`h-11 w-full rounded-lg border bg-canvas/60 pr-11 pl-3.5 text-[14px] outline-none transition-colors focus:border-subtle ${
              error ? 'border-danger/70' : 'border-edge'
            }`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-raised hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {visible && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
        {error && (
          <p id="password-error" role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent" />}
        {pending ? 'Checking' : 'Sign in'}
      </button>
    </form>
  );
}
