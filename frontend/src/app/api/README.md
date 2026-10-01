# Next API Routes

This folder contains the Vercel-ready Node.js backend for the app.

Health checks:

- `GET /api/health`
- `GET /api/db/health`

The catch-all route in `[...path]/route.ts` handles the application API groups:

- `/api/auth/*`
- `/api/dashboard*`
- `/api/business/*`
- `/api/loyalty-card`
- `/api/public/*`
- `/api/stamp`
- `/api/redeem-reward`
- `/api/user/*`

Database access stays in `src/lib/server/*` so secrets such as `DATABASE_URL` are only used on the server.
