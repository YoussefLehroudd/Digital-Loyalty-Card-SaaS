## TODO - Phase 7: Staff QR Scanner + Add Stamp (Frontend)
- [x] Step 1: Add QR scanning dependency to frontend/package.json and install it
- [ ] Step 2: Create scanner page `frontend/src/app/dashboard/scanner/page.tsx`
- [ ] Step 3: Create scanner components
  - [ ] `frontend/src/components/scanner/StaffQrScanner.tsx`
  - [ ] `frontend/src/components/scanner/StampResult.tsx`
- [ ] Step 4: Integrate POST `/api/stamp` using existing token + `apiFetch` pattern
- [ ] Step 5: Update `frontend/src/components/dashboard/dashboard-shell.tsx` so activeItem includes `"scanner"`
- [ ] Step 6: Run frontend checks/build (npm run lint + npm run build)
