# Deployment

This repository is prepared for separate frontend and backend deployments.

## Frontend: Vercel

Create a Vercel project from this GitHub repository.

- Root Directory: `apps/frontend`
- Framework Preset: `Next.js`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Environment Variable: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`

Vercel reads `apps/frontend/vercel.json` when the project root is set to `apps/frontend`.

## Backend: Render

Create a Render Blueprint from this GitHub repository. Render reads `render.yaml` from the repository root and builds the Spring Boot app with Docker.

- Service: `wax-cracking-backend`
- Runtime: Docker
- Root Directory: `apps/backend`
- Health Check Path: `/api/health`
- Database: not configured

After the backend is live, copy its `onrender.com` URL into Vercel as `NEXT_PUBLIC_API_BASE_URL`.

For production CORS, set the Render environment variable `FRONTEND_ORIGIN_PATTERNS` to your deployed Vercel domain, for example:

```text
https://your-project.vercel.app,https://*.vercel.app
```
