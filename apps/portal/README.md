# Askwell portal

Admin tokens for Preflight: let chosen people use Improve on your Anthropic key, each with a daily
limit, an optional expiry and a revoke button. One admin (you), signed in with a password.

## Run it locally

```
cp apps/portal/.env.example apps/portal/.env.local   # then fill in ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET
pnpm --filter @askwell/portal dev                     # http://localhost:3100
```

Without `DATABASE_URL` it uses an in-memory database that resets when the server restarts. Without
`ANTHROPIC_API_KEY` everything works except the rewrite itself, which answers 503.

## Deploy (Neon + Vercel, both free tiers)

1. **Database:** in [Neon](https://console.neon.tech), create a project (any region near you) and copy
   its connection string (`postgresql://…`). The tables are created on first use.
2. **Vercel:** [Add New → Project](https://vercel.com/new), import `shashwatgoyal-codes/askwell`, and
   set **Root Directory** to `apps/portal`. Vercel detects Next.js and the pnpm workspace.
3. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string |
   | `ADMIN_EMAIL` | the email you'll sign in with |
   | `ADMIN_PASSWORD_HASH` | a scrypt hash of a long password (20+ characters from a password manager). Make it with `pnpm --filter @askwell/portal hash-password`, which asks for the password twice without showing it. The password itself is stored nowhere, and a plain `ADMIN_PASSWORD` is not accepted. |
   | `SESSION_SECRET` | 32+ random characters: `openssl rand -base64 48` |
   | `ANTHROPIC_API_KEY` | your key; token holders' rewrites are billed to it |
   | `PORTAL_MODEL` | optional, defaults to `claude-opus-5-5` |
   | `GLOBAL_DAILY_LIMIT` | optional cap across all tokens per day, defaults to 200 |

4. **Deploy**, open the URL, sign in, create a token. Give the person the portal address and the token;
   they paste both into Preflight's settings under **Admin token**.

Set a monthly spend limit on the Anthropic key too: the portal's caps limit rewrites per day, and the
spend limit is the backstop.

## How it keeps the key and the bill safe

- Your Anthropic key exists only on the server; token holders never see it, and errors never echo it.
- Tokens are stored as SHA-256 hashes, shown once at creation, and can be revoked at any time.
- Each token has a daily limit, enforced in one database statement so simultaneous requests can't
  overshoot it, and `GLOBAL_DAILY_LIMIT` caps all tokens together.
- Nothing is counted, and no provider call is made, for a request the portal refuses.
- Sign-in needs your email and password; a wrong attempt never says which was wrong. After 5 failures
  from one network in 15 minutes that network is locked out for 15 minutes, and after 20 failures from
  anywhere in an hour sign-in is paused for everyone for an hour. While locked, even the right password is
  refused.
- The admin password is never stored, only a salted scrypt hash of it (N = 2¹⁵, r = 8), so someone who
  reads the Vercel settings still can't sign in or recover the password.
- The admin session is a signed, HTTP-only, same-site cookie.
- The portal stores no prompt text: only token metadata and per-day counts.
