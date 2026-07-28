#!/bin/sh
set -eu

# Run once at container startup so Laravel caches don't get baked with wrong env.
php artisan optimize:clear || true

exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
