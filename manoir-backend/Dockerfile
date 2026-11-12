# API Laravel 13 (PHP 8.3) — image conteneur pour Render.
FROM php:8.3-cli

# Dépendances système + extensions PHP (dont pdo_pgsql pour Neon)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git unzip libpq-dev libzip-dev libonig-dev \
    && docker-php-ext-install pdo_pgsql pgsql mbstring bcmath zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Installer les dépendances d'abord (cache Docker)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

# Copier le reste de l'app
COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && chmod -R 775 storage bootstrap/cache

# Render fournit $PORT (souvent 10000)
ENV PORT=8080
EXPOSE 8080

# Cache config/routes, worker de file d'attente (mails : verification,
# notifications admin, confirmations client) puis serveur HTTP sur $PORT.
# Sans worker, les mails mis en file ne partiraient jamais.
# (les migrations sont jouees via preDeployCommand dans render.yaml)
CMD php artisan config:cache \
    && php artisan route:cache \
    && (php artisan queue:work --tries=3 --backoff=60 --sleep=3 &) \
    && php artisan serve --host=0.0.0.0 --port=$PORT