# Next API Routes

This folder is the Vercel-ready backend layer for the app.

Current endpoints:

- `GET /api/health`
- `GET /api/db/health`

Move Laravel endpoints from `backend/routes/api.php` into this folder gradually. Keep database access in `src/lib/server/*` so secrets like `DATABASE_URL` never reach client components.
