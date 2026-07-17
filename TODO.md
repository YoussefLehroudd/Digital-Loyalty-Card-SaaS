# TODO

- [x] Create route-scoped middleware to force Sanctum stateless handling for public API endpoints. (replaced with approved CSRF exception approach)
- [x] Register middleware alias in `backend/bootstrap/app.php`. (not needed after approved approach)
- [x] Apply middleware to public routes in `backend/routes/api.php`. (not needed after approved approach)
- [x] Run backend tests: `cd backend && php artisan test`.
- [ ] Browser-verify public registration flow on `http://localhost:3000/fahey-group` with valid payload.
- [ ] Summarize files changed, Sanctum preservation rationale, test results, and browser outcome.
