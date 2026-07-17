# Digital Loyalty Card SaaS

Production-oriented MVP for a multi-tenant digital loyalty card platform.

## Phase 1

This phase creates the foundation only:

- `frontend`: Next.js 15, TypeScript, TailwindCSS, shadcn-compatible UI primitives, Lucide icons, dark mode support.
- `backend`: Laravel 12 REST API, Sanctum installed, API route file enabled, PostgreSQL env defaults.
- `docker-compose.yml`: local PostgreSQL service for development.

## Local Development

Start PostgreSQL:

```bash
docker compose up -d
```

Start the Laravel API:

```bash
cd backend
php artisan serve
```

Start the Next.js frontend:

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000/api`
- API health: `http://localhost:8000/api/health`

## Environment

Copy environment files before running new installs:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

The backend expects PostgreSQL by default:

- database: `digital_loyalty`
- username: `loyalty`
- password: `secret`
- port: `5432`

On this machine, Composer was downloaded as `composer.phar` because no global Composer binary was available.

For Laravel commands on this machine, PHP needs these extensions enabled:
`openssl`, `curl`, `mbstring`, `fileinfo`, `pdo_pgsql`, `pgsql`, `pdo_sqlite`, `sqlite3`, and `zip`.

## Phase 2

Authentication is implemented with Laravel Sanctum API tokens.

Frontend routes:

- `/register`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/dashboard` protected for `business_owner`

API routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/dashboard/session`

Database additions:

- `businesses`
- `users.business_id`
- `users.role`

## Phase 3

Business dashboard is implemented for authenticated business owners.

API route:

- `GET /api/dashboard`

Returned metrics:

- `total_customers`
- `active_customers`
- `visits_this_month`
- `rewards_redeemed`

Dashboard metric tables added:

- `customers`
- `visits`
- `reward_redemptions`

All dashboard metric queries are scoped to the authenticated user's `business_id`.
