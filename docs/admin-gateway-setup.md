# Admin gateway: permanent setup

Problem this solves: the backend refuses every `/api/admin*` request unless it carries the gateway secret header (`ZTNA_GATEWAY_SECRET` on Railway). A browser cannot hold that secret (anything in browser code is public), so the admin panel was blocked with a 403 before the password was even checked.

## How it works now

```
Admin person -> Cloudflare Access login -> admin.paperly-nt.com (Vercel, this app)
   browser calls /api/gateway/...  (same site)
   -> server route src/pages/api/gateway/[...path].ts
        1. checks the Cloudflare Access login token (if configured)
        2. adds the secret header (server-only variable)
        3. forwards to the Railway backend
   -> backend: gateway secret check, then the normal admin email + password + role check
```

Three gates: Cloudflare Access login, the gateway secret, and the admin email/password/role. The secret never reaches browser code.

## Setup for a locally-run admin panel (the current setup)

The admin panel runs on the admin's own computer (`npm run dev`) and talks to the Railway backend. The proxy route runs inside that local Next server, so the secret stays in a file on that computer and never goes to a browser or to Vercel.

1. Create `paperly-admin-panel/.env.local` (git-ignored) with:
   ```
   NEXT_PUBLIC_API_BASE_URL=/api/gateway
   ADMIN_BACKEND_URL=https://<your-railway-host>/api
   ADMIN_GATEWAY_SECRET=<a new long random value, at least 40 characters>
   ```
   Remove or override any `NEXT_PUBLIC_API_BASE_URL` line in other `.env` files so this one wins.
2. Railway backend variables, then redeploy:
   - `ZTNA_GATEWAY_SECRET` = the same value as `ADMIN_GATEWAY_SECRET`
   - `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` as intended
3. Restart the admin panel (`npm run dev`), open it, and sign in with the admin account.

Why this is safe: the admin panel is not on the internet at all (only on the admin's machine), the backend refuses every admin request that lacks the secret, and the admin email/password/role check still applies. The 4.5 MB and 60 second limits mentioned below do not apply when running locally.

To work against a purely local backend instead, use `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8003/api` and leave the secret empty on both sides.

## If the admin panel is ever hosted (for example on Vercel)

Set the same three variables in that project (plus an Access or password wall in front of it, see below), and `ZTNA_GATEWAY_SECRET` on Railway. Leave `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` unset unless Cloudflare Access is used.

## Optional extra login wall (add later, any one of these)

- In-app two-step login (authenticator code) for admin accounts. No vendor, works with what you have. Recommended next.
- Vercel Pro deployment protection or password protection on the admin project (check the current plan and add-on price in Vercel first).
- Cloudflare Access in front of the admin site: requires moving the domain's DNS to Cloudflare; then set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` and the proxy will require the Access login.

## Local development

Leave `ZTNA_GATEWAY_SECRET` empty locally and keep `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8003/api`. Nothing changes.

## Limits to know

- Vercel functions cap request and response bodies at about 4.5 MB and run for up to 60 seconds. Large backup exports or restores above that size will not pass through this proxy; run those from a local admin session or move that single call to a signed direct download later.
- Rotate `ADMIN_GATEWAY_SECRET` by changing it on Vercel and Railway together (redeploy both).
