# Use non-ZTS PHP CLI base image
FROM php:8.2-cli

# Install system deps + PHP extensions (including pcntl) + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    curl \
    supervisor \
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

# Install Composer (backend-only build context; repo root composer.phar is not available here)
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Copy composer files first for layer caching
COPY composer.json composer.lock /app/

# Install PHP dependencies
RUN composer install --no-interaction --no-dev --optimize-autoloader

# Copy the rest of the backend source (build context is `backend/`)
COPY . /app/

# Copy a default .env if none exists (Railway should override env vars anyway)
RUN if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi

# Ensure writable dirs
RUN mkdir -p /app/storage /app/bootstrap/cache && chmod -R 777 /app/storage /app/bootstrap/cache

# Supervisor to run API + Reverb
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
