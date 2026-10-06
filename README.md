# Digital Loyalty Card SaaS

Production-oriented MVP for a multi-tenant digital loyalty card platform.

The app now runs as a single Vercel-hosted Next.js project:

- `frontend`: Next.js 15, TypeScript, Tailwind CSS, shadcn-compatible UI primitives, Lucide icons, dark mode support.
- `frontend/src/app/api`: Vercel-ready Node.js API routes.
- `frontend/src/lib/server/db.ts`: Neon PostgreSQL connection for server-side code.
- `frontend/src/app/api/[...path]/route.ts`: API dispatcher for auth, dashboard, business profile, loyalty cards, customers, rewards, stamping, public wallet pages, and Google Wallet links.

## Production

Deploy the `frontend` directory to Vercel.

Required Vercel settings:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Install Command: `npm install`
- Framework Preset: `Next.js`

Required environment variables:

- `DATABASE_URL`: Neon pooled PostgreSQL connection string.
- `NEXT_PUBLIC_APP_URL`: production app URL.
- `NEXT_PUBLIC_API_URL`: leave empty or set to `/api` so the app uses the Vercel API routes.
- `CLOUDINARY_NAME` or `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_CLIENT_EMAIL`
- `GOOGLE_WALLET_PRIVATE_KEY`

## Local Development

Create `frontend/.env.local` from the example file, then run:

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:

- App: `http://localhost:3000`
- API health: `http://localhost:3000/api/health`
- Database health: `http://localhost:3000/api/db/health`

## API

The app uses relative API calls by default. If `NEXT_PUBLIC_API_URL` is not set, requests go to `/api`.

Important route groups:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/dashboard/session`
- `GET /api/dashboard`
- `GET/PATCH /api/business/profile`
- `POST /api/business/profile/logo`
- `POST /api/business/profile/hero-image`
- `GET/POST/PUT /api/loyalty-card`
- `GET /api/business/customers`
- `GET /api/business/rewards`
- `POST /api/stamp`
- `POST /api/redeem-reward`
- `GET /api/public/businesses/:slug`
- `POST /api/public/businesses/:slug/customers/register`
- `GET /api/public/customers/wallet/:qrCode`
- `POST /api/user/register`
- `POST /api/user/login`
- `GET /api/user/cards`
- `POST /api/user/wallet/google/:membershipId`
