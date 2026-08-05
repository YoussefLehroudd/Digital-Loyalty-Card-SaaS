# TODO — Reverb -> Pusher Cloud migration (code-only)

## Steps
1. Update backend realtime broadcaster default/connection to `pusher`
   - File: `backend/config/broadcasting.php`
2. Update Next.js Echo client from Reverb to Pusher Cloud
   - File: `frontend/src/components/echo/echo-provider.tsx`
3. (No secret exposure) Ensure code uses only `NEXT_PUBLIC_PUSHER_*` realtime variables and removes local WS endpoint configuration.
4. Verification (after deploying env changes):
   - Echo connects (client logs)
   - Subscribe to existing channels (public test + existing business private)
   - Trigger existing Laravel broadcast events
   - Confirm Next.js receives event callbacks
5. Rollback instructions (stop further changes; revert the two files)
