# Mise en ligne - Le Manoir

Ce guide decrit la mise en ligne du projet actuel.

Le depot contient :

- `manoir-frontend` : interface Next.js
- `manoir-backend` : API Laravel
- medias actuels du site et des categories

Le depot ne doit pas contenir :

- `node_modules`
- `.next`
- `.npm-cache`
- `vendor`
- fichiers `.env` reels
- logs et caches locaux

Ces elements sont ignores par `.gitignore`.

## Backend Laravel

Sur le serveur, depuis `manoir-backend` :

```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Variables principales a configurer :

```env
APP_NAME="Le Manoir"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.votre-domaine.com

DB_CONNECTION=mysql
DB_HOST=...
DB_PORT=3306
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...

MAIL_MAILER=...
MAIL_HOST=...
MAIL_PORT=...
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=...
MAIL_FROM_NAME="Le Manoir"
```

Le backend expose les routes sous :

```text
https://api.votre-domaine.com/api
```

## Frontend Next.js

Sur le serveur, depuis `manoir-frontend` :

```bash
npm ci
npm run build
npm run start
```

Variables principales a configurer :

```env
NEXT_PUBLIC_API_URL=https://api.votre-domaine.com/api
NEXT_PUBLIC_APP_NAME=Manoir
NEXT_PUBLIC_APP_URL=https://www.votre-domaine.com
```

## Medias

Les medias actuels uploades depuis l'administration sont inclus dans :

```text
manoir-backend/storage/app/public/room-categories
```

Apres deploiement Laravel, la commande suivante doit etre lancee pour rendre ces fichiers accessibles :

```bash
php artisan storage:link
```

## Paiement actuel

Le site contient actuellement un flux de paiement interne :

- le client clique sur "Payer la caution" ou "Payer mon sejour",
- le paiement est valide dans l'application,
- le message de succes est affiche,
- la reservation et les documents sont mis a jour.

Les fournisseurs acceptes par l'API sont `fedapay` et `kkiapay`, mais aucun SDK externe de paiement n'est installe dans le depot actuel.

## Taches a faire sur le serveur

1. Installer les dependances backend.
2. Creer le fichier `.env` Laravel.
3. Configurer la base de donnees.
4. Lancer les migrations.
5. Lancer `php artisan storage:link`.
6. Installer et builder le frontend.
7. Configurer `NEXT_PUBLIC_API_URL` vers l'API Laravel.
8. Configurer HTTPS sur les domaines.

## Verifications apres deploiement

Backend :

```text
https://api.votre-domaine.com/api/room-categories
```

Frontend :

```text
https://www.votre-domaine.com
```

Administration :

```text
https://www.votre-domaine.com/admin
```

Espace client :

```text
https://www.votre-domaine.com/espace-client
```
