# Platform administration

The private workspace is available at `/admin`, with a dedicated sign-in page at `/admin/login`. It uses a separate browser session from the business/customer applications. There is no public administrator registration.

## Access

An account is authorized when its persisted role is `platform_admin`, or its immutable app user UUID is explicitly included in the server-only `PLATFORM_ADMIN_USER_IDS` environment variable (comma-separated). An existing business owner can therefore administer the platform without changing their business role. Never authorize administrators by a user-editable email address or client-side flag.

Every `/api/admin/*` endpoint verifies the session and permission. The middleware redirect is only a navigation convenience. Invalid login responses are generic, and login/password routes are rate limited.

## Workspace

- Overview: actual platform totals, 14-day stamp activity, leading businesses.
- Businesses and customers: parameterized search, status filters, 25-row pagination, account details and status management.
- Activity: stamps, rewards, and administrator audit records, with filters and pagination.
- Settings: administrator identity, integration configuration indicators, password change and sign-out.

Visible pages refresh every three seconds, with no overlapping requests, cancellation on navigation, slower polling while hidden, and error backoff. A failed connection is shown explicitly. These live updates use polling.

## Account status

Suspending a customer revokes sessions and prevents sign-in. Suspending a business revokes its owner sessions and prevents dashboard access, scanning, and new memberships/registrations. Existing cards and history remain stored. Reactivation allows a fresh sign-in; revoked sessions do not become valid again.

Administrators cannot suspend themselves, their own business, or other administrator accounts through the customer directory. Status updates and audit insertion commit in the same database transaction. Changing an administrator password records an audit event and revokes other sessions while retaining the current administrator session.

The schema initializer adds `status` (default `active`) to `app_users` and `businesses`, creates `admin_audit_logs`, and adds the customer user index. Existing accounts retain their current access by default. No account deletion, impersonation, payment processing, or secret editing is exposed in this workspace.
