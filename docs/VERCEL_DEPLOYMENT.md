# Vercel deployment plan — SkillGap

Everything you need to deploy SkillGap to Vercel and keep it running smoothly.

---

## 1. Pre-deploy checklist (already done)

| Item | Status |
|------|--------|
| Next.js app with `build` script | ✅ `npm run build` |
| Code on GitHub (`steffanhowey/skillgap`) | ✅ |
| `.gitignore` includes `.next`, `node_modules`, `.env*`, `.vercel` | ✅ |
| Production build succeeds locally | ✅ Verified |
| No hardcoded secrets; auth is stubbed | ✅ |

---

## 2. Connect and deploy on Vercel (do this once)

1. **Sign in**  
   Go to [vercel.com](https://vercel.com) and sign in with the same GitHub account (**steffanhowey**).

2. **Import the repo**  
   - Click **Add New… → Project**.  
   - Select **Import** next to `steffanhowey/skillgap` (or paste `https://github.com/steffanhowey/skillgap`).  
   - Click **Import**.

3. **Project settings (keep defaults)**  
   - **Framework Preset:** Next.js (auto-detected).  
   - **Root Directory:** `./` (repo root = app root).  
   - **Build Command:** `next build` (default).  
   - **Output Directory:** (leave default; Vercel uses Next.js output).  
   - **Install Command:** `npm install` (default).

4. **Environment variables**  
   - You don’t need any for the current app (no `process.env` / auth backend yet).  
   - When you add auth or APIs later, add vars in **Project → Settings → Environment Variables** (e.g. `NEXT_PUBLIC_*` for client, others for server).

5. **Deploy**  
   Click **Deploy**. Vercel will build and give you a URL like `skillgap-*.vercel.app`.

---

## 3. After first deploy

- **Production URL** — Use the `*.vercel.app` URL (or add a custom domain in **Project → Settings → Domains**).
- **Preview deployments** — Every push to a branch (and every PR) gets its own preview URL.
- **Redeploys** — Pushing to `main` triggers a new production deploy automatically.

---

## 4. When you add auth or env vars later

1. **Env vars**  
   Add them in Vercel: **Project → Settings → Environment Variables**.  
   Use the same names as in your code (e.g. `NEXT_PUBLIC_APP_URL`, auth client IDs).  
   Redeploy after adding or changing variables.

2. **Auth redirect URLs**  
   If you use OAuth (e.g. Supabase, NextAuth):  
   - Add your Vercel production URL and preview URL pattern to the provider’s allowed redirect/callback URLs.  
   - Example: `https://skillgap-xxx.vercel.app/callback`, `https://*.vercel.app/callback` for previews.

---

## 5. Optional: `vercel.json` (only if you need it)

You don’t need this for a standard Next.js app. Add a `vercel.json` at the repo root only if you want:

- Redirects or rewrites  
- Custom headers  
- A different Node version  

Example (only if required later):

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build"
}
```

---

## 6. Quick reference

| Action | Where |
|--------|--------|
| Change env vars | Vercel → Project → Settings → Environment Variables |
| Custom domain | Vercel → Project → Settings → Domains |
| View logs / builds | Vercel → Project → Deployments |
| Local build | `npm run build` |
| Local prod run | `npm run build && npm run start` |

---

## Summary

1. Sign in to Vercel with GitHub.  
2. Import **steffanhowey/skillgap**.  
3. Leave all build settings as default and click **Deploy**.  
4. Use the generated URL (and optionally add a custom domain).  
5. When you add env vars or auth, set them in Project Settings and update redirect URLs with your Vercel URL.

Your repo is already in good shape for Vercel; no code changes are required for the first deploy.
