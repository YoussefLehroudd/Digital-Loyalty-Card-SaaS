# Use non-ZTS PHP CLI base image
FROM php:8.2-cli

# Install system deps + PHP extensions (including pcntl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    curl \
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
    mbstring \
    && true

# For better performance & predictable behavior
ENV APP_ENV=production \
    PHP_MEMORY_LIMIT=512M

WORKDIR /app

# Copy backend composer files first for layer caching
COPY backend/composer.json backend/composer.lock /app/

# Install composer
COPY composer.phar /usr/local/bin/composer
RUN chmod +x /usr/local/bin/composer

# Install PHP dependencies
RUN composer install --no-interaction --no-dev --optimize-autoloader || composer install --no-interaction --optimize-autoloader

# Copy the rest of the backend source
COPY backend/ /app/

# Build frontend assets used by Laravel (Vite) if needed
# (If you already build assets elsewhere, you can remove this step.)
RUN if [ -f package.json ]; then npm install && npm run build; fi

# Copy a default .env if none exists (Railway should override env vars anyway)
RUN if [ ! -f .env ]; then cp .env.example .env; fi

# Ensure writable dirs
RUN mkdir -p /app/storage /app/bootstrap/cache && chmod -R 777 /app/storage /app/bootstrap/cache

# Supervisor to run API + Reverb
COPY backend/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000 8080

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
