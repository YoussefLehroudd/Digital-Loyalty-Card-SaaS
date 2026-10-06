"""Bounded, read-only HTTP burst check. Never infers full user capacity from public probes."""
import argparse
import concurrent.futures
import json
import math
import os
import subprocess
import time
from urllib.parse import urlparse


def percentile(values, p):
    ordered = sorted(values)
    return round(ordered[max(0, math.ceil(len(ordered) * p) - 1)] * 1000, 1) if ordered else None


def worker(base, path, expected, count, token):
    # curl reuses the HTTPS connection between transfers in each worker.
    config = ['silent', 'show-error', 'connect-timeout = 10', 'max-time = 20',
              'write-out = "%{http_code} %{time_total} %{time_appconnect} %{time_starttransfer}\\n"']
    if token:
        config.append('header = ' + json.dumps('Authorization: Bearer ' + token))
    for _ in range(count):
        config.extend(['url = ' + json.dumps(base + path), 'output = "/dev/null"'])
    result = subprocess.run(['curl', '--config', '-'], input='\n'.join(config),
                            text=True, capture_output=True, timeout=count * 22)
    records = []
    for line in result.stdout.splitlines():
        try:
            status, total, tls, ttfb = line.split()
            records.append({'ok': int(status) == expected, 'status': int(status),
                            'total': float(total), 'tls': float(tls), 'ttfb': float(ttfb)})
        except ValueError:
            continue
    while len(records) < count:
        records.append({'ok': False, 'status': 0, 'total': 20, 'tls': 0, 'ttfb': 20})
    return records


def run_stage(base, path, expected, connections, count, token):
    start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=connections) as pool:
        groups = list(pool.map(lambda _: worker(base, path, expected, count, token), range(connections)))
    elapsed = time.perf_counter() - start
    records = [item for group in groups for item in group]
    # A failed initial transfer may cause a later TLS reconnect: exclude that
    # transfer too, rather than treating every transfer after the first as warm.
    warm = [item for group in groups for item in group if item['ok'] and item['tls'] == 0]
    failures = sum(not item['ok'] for item in records)
    return {'path': path, 'concurrent_connections': connections, 'requests': len(records),
            'failures': failures, 'statuses': sorted(set(item['status'] for item in records)),
            'elapsed_seconds': round(elapsed, 2), 'requests_per_second': round(len(records) / elapsed, 2),
            'warm_samples': len(warm), 'warm_p50_ms': percentile([x['total'] for x in warm], .5),
            'warm_p95_ms': percentile([x['total'] for x in warm], .95),
            'cold_tls_p50_ms': percentile([group[0]['tls'] for group in groups], .5)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='https://digital-loyalty-card-saa-s.vercel.app')
    parser.add_argument('--profile', choices=['public', 'customer'], default='public')
    parser.add_argument('--connections', default='1,3,5')
    parser.add_argument('--requests-per-connection', type=int, default=6)
    args = parser.parse_args()
    levels = [int(n) for n in args.connections.split(',')]
    if not levels or any(n < 1 or n > 25 for n in levels) or not 2 <= args.requests_per_connection <= 20:
        parser.error('Use 1–25 connections and 2–20 requests per connection.')
    base = args.base_url.rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
        parser.error('Use an HTTPS URL without credentials.')
    token = os.environ.get('LOYVANCE_TEST_TOKEN', '') if args.profile == 'customer' else ''
    if args.profile == 'customer' and (not token or any(c in token for c in '\r\n')):
        parser.error('Set LOYVANCE_TEST_TOKEN to a dedicated customer test session token.')
    routes = [('/', 200), ('/api/public/businesses/loyvance-capacity-probe-not-a-business', 404)] if args.profile == 'public' else [('/api/user/cards', 200), ('/api/user/notifications', 200), ('/api/realtime-version', 200), ('/api/user/rewards', 200), ('/api/user/activity', 200)]
    print(json.dumps({'profile': args.profile, 'scope': 'read-only bursts; connections are not simulated users',
                      'note': 'Public 404 is intentional and validates a database lookup miss. Warm timings include network latency.'}), flush=True)
    for path, expected in routes:
        baseline = None
        for level in levels:
            result = run_stage(base, path, expected, level, args.requests_per_connection, token)
            print(json.dumps(result), flush=True)
            if result['failures']:
                print(json.dumps({'stopped': True, 'reason': 'Unexpected HTTP status or timeout. No higher load applied.'}), flush=True)
                return 1
            if baseline is None:
                baseline = result['warm_p95_ms']
            elif result['warm_p95_ms'] and baseline and result['warm_p95_ms'] > max(3000, baseline * 3):
                print(json.dumps({'stopped': True, 'reason': 'Warm p95 latency degraded. No higher load applied.'}), flush=True)
                return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
