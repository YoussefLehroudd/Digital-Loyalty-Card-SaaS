# Use non-ZTS PHP CLI base image
FROM php:8.2-cli

# Install system deps + PHP extensions (including pcntl) + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    curl \
    supervisor \
    nginx \
    gettext-base \
    libpq-dev \
    libzip-dev \
    libonig-dev \
    && rm -rf /var/lib/apt/lists/*

# Enable bundled extensions
RUN docker-php-ext-install \
    pcntl \
    pdo_pgsql \
    pgsql \
    zip \
    mbstring

# For better performance & predictable behavior
ENV APP_ENV=production \
    PHP_MEMORY_LIMIT=512M

WORKDIR /app

# Copy the full Laravel project first (composer install triggers artisan package discovery)
COPY . /app/

# Install Composer (backend-only build context; repo root composer.phar is not available here)
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Allow composer to run as superuser inside the build container
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install PHP dependencies
RUN composer install --no-interaction --no-dev --optimize-autoloader

# Clear caches (safe if files/config not fully present yet)
RUN php artisan config:clear || true \
 && php artisan route:clear || true \
 && php artisan view:clear || true

# Copy a default .env if none exists (Railway should override env vars anyway)
RUN if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi

# Ensure writable dirs
RUN mkdir -p /app/storage /app/bootstrap/cache && chmod -R 777 /app/storage /app/bootstrap/cache

# Supervisor + Nginx config/templates
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY start-nginx.sh /usr/local/bin/start-nginx.sh
RUN chmod +x /usr/local/bin/start-nginx.sh

# Internal API/Reverb ports + public nginx port
EXPOSE 8000
EXPOSE 8081

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
