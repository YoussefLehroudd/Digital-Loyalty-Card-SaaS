# Vercel + Neon Deployment

This repository currently has two parts:

- `frontend/`: Next.js 15 application. This is the part Vercel should deploy.
- `backend/`: Laravel API. Laravel cannot run as the main backend on Vercel without a separate PHP runtime/adapter, so the backend must be migrated endpoint by endpoint to Next.js API routes if the final target is Vercel-only.

## Vercel Project Settings

Import the GitHub repository into Vercel and use these settings:

- Framework Preset: `Next.js`
- Root Directory: `frontend`
- Install Command: default is fine, or `npm install`
- Build Command: `npm run build`
- Output Directory: leave default for Next.js

## Environment Variables

Set these in Vercel Project Settings > Environment Variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_API_URL=https://your-vercel-domain.vercel.app/api
```

Use the pooled Neon connection string for `DATABASE_URL` in Vercel. Keep the unpooled/direct string for migrations only.

## Health Checks

After deploying, test:

- `/api/health` checks the Next.js API runtime.
- `/api/db/health` checks the Neon connection through `DATABASE_URL`.

## Backend Migration Status

The new Next.js API layer is ready, but the Laravel API is not fully migrated yet.

Existing Laravel route groups that still need to be ported to `frontend/src/app/api/**`:

- business auth: `/api/auth/*`
- customer auth: `/api/user/*`
- dashboard/session and dashboard metrics
- business profile and logo/hero upload
- loyalty-card settings
- stamp and reward redemption
- business customers and rewards
- public business/customer wallet routes
- customer portal token routes
- realtime/broadcasting endpoints

## Recommended Next Step

Migrate the API in slices:

1. Auth and session routes.
2. Dashboard read routes.
3. Loyalty card and customer routes.
4. Stamp/reward write routes.
5. Realtime updates.

For realtime with only Vercel + Neon, start with lightweight polling or Server-Sent Events. A permanent WebSocket server is not a good fit for Vercel serverless functions.
