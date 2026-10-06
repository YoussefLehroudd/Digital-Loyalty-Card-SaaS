# Production HTTP burst baseline — 2026-10-06 UTC

Read-only probes against https://digital-loyalty-card-saa-s.vercel.app.
No customer accounts, stamps, rewards, emails or business data were modified.

## Scope and limitations

These are parallel HTTP clients, not simulated logged-in users. The homepage is
cached by Vercel. The public API probe intentionally queries a nonexistent
business slug and expects HTTP 404 with "Business not found."; it exercises the
API/database lookup miss, not a real loyalty card or customer dashboard.

The runner connects through a proxy. Initial TLS handshakes took roughly
4.5–8.2 seconds, so total burst throughput cannot be used to estimate application
capacity. Connections were reused within each client. Percentiles below for
successful stages exclude the initial transfer. No browser, scan, redeem,
Google Wallet or authenticated realtime workload was load-tested.

## Measurements

| Route | Parallel clients | Requests | Unexpected failures | Successful warm p95 |
| --- | ---: | ---: | ---: | ---: |
| Homepage | 1 | 6 | 0 | 356.2 ms |
| Homepage | 3 | 18 | 0 | 366.7 ms |
| Homepage | 5 | 30 | 0 | 323.7 ms |
| Homepage | 10 | 40 | 0 | 547.2 ms |
| Homepage | 25 | 100 | 0 | 531.8 ms |
| API / Neon lookup miss | 1 | 6 | 0 | 335.1 ms |
| API / Neon lookup miss | 3 | 18 | 0 | 403.6 ms |
| API / Neon lookup miss | 5 | 30 | 0 | 383.9 ms |
| API / Neon lookup miss | 10 | 40 | 0 | 347.6 ms |
| API / Neon lookup miss | 25 | 100 | 6 transport failures | Not reported: reconnect TLS polluted the original warm grouping |

Total: 388 planned transfers. All returned HTTP responses had the expected status.
The 25-client API stage included six curl status-0 transport failures.
The tool stopped automatically; no higher load was applied.
Their source is unresolved: runner/proxy transport and application limitations
cannot be distinguished from this run. This is not evidence of a 25-user limit.

After the test, the reusable script's warm filtering was corrected to require
time_appconnect == 0, so later reconnects are not counted as warm transfers.

## Repeat and next step

From frontend/ with Python 3 and curl installed:

    python scripts/capacity-check.py

The default runs 1, 3 and 5 clients, six GET requests per client, per route.
The script rejects more than 25 clients or more than 20 transfers per client,
and stops on unexpected HTTP statuses, transport failures or material latency
degradation.

For a dedicated customer test session, set LOYVANCE_TEST_TOKEN in the environment,
then run:

    python scripts/capacity-check.py --profile customer --connections 1,3,5

Do not put session tokens in source control or command arguments.
The customer profile tests cards, notifications, realtime-version, rewards and
activity separately. It still tests HTTP bursts, not the complete mixed user
journey. A real capacity test must use separate test accounts with representative
card/history volumes, reproduce simultaneous polling and visits, and correlate
latency/error rates with Vercel and Neon metrics from a runner without this
proxy bottleneck. No maximum simultaneous-user number is established yet.
