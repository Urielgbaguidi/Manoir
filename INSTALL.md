# Installation locale - Le Manoir

Ce guide permet de lancer Le Manoir en local avec :

- Backend Laravel sur `http://localhost:8000`
- Frontend Next.js sur `http://localhost:3000`

## Prerequis

- PHP 8.3 ou plus
- Composer
- Node.js 18 ou plus
- npm
- Extension PHP SQLite active

Le projet utilise SQLite en local. Il n'est donc pas necessaire de lancer MySQL dans XAMPP pour tester le site.

## 1. Installer le backend Laravel

Ouvrir PowerShell dans le dossier du projet :

```powershell
cd C:\xampp\htdocs\Manoir\manoir-backend
composer install
if (!(Test-Path .env)) { copy .env.example .env }
if (!(Test-Path database\database.sqlite)) { New-Item -ItemType File database\database.sqlite | Out-Null }
php artisan key:generate
```

Verifier que `manoir-backend\.env` contient bien :

```env
APP_NAME="Le Manoir"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=sqlite

MAIL_MAILER=log
```

Lancer ensuite les migrations, les donnees de test et le serveur backend :

```powershell
php artisan migrate
php artisan db:seed --class=UserSeeder
php artisan db:seed --class=RoomSeeder
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

Le backend doit repondre sur :

```text
http://localhost:8000
```

L'API doit repondre sur :

```text
http://localhost:8000/api
```

## 2. Installer le frontend Next.js

Ouvrir un autre terminal PowerShell :

```powershell
cd C:\xampp\htdocs\Manoir\manoir-frontend
npm ci
if (!(Test-Path .env.local)) { copy .env.example .env.local }
```

Verifier que `manoir-frontend\.env.local` contient :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Manoir
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Lancer le frontend :

```powershell
npm run dev
```

Le frontend doit repondre sur :

```text
http://localhost:3000
```

## 3. Comptes de test

Apres les seeders :

### Admin

```text
Email: admin@manoir.com
Mot de passe: password123
```

### Client

```text
Email: client@test.com
Mot de passe: password123
```

## 4. Verification rapide

Tester l'API :

```text
http://localhost:8000/api/room-categories
```

Tester le site :

```text
http://localhost:3000
```

Tester l'administration :

```text
http://localhost:3000/admin
```

Tester l'espace client :

```text
http://localhost:3000/espace-client
```

## 5. Commandes utiles

Frontend :

```powershell
cd C:\xampp\htdocs\Manoir\manoir-frontend
npm run lint
npm run build
```

Backend :

```powershell
cd C:\xampp\htdocs\Manoir\manoir-backend
php artisan test
vendor\bin\pint --test
```

## 6. Reinstallation apres nettoyage

Si `node_modules`, `.next` ou `vendor` ont ete supprimes pour alleger le projet, il suffit de relancer :

```powershell
cd C:\xampp\htdocs\Manoir\manoir-frontend
npm ci
```

Puis :

```powershell
cd C:\xampp\htdocs\Manoir\manoir-backend
composer install
```

Ces dossiers sont volontairement ignores par Git.

## 7. Resume de la bonne methode locale

Pour tester le projet en local :

1. Installer PHP, Composer, Node.js et npm.
2. Ne pas creer de base MySQL.
3. Utiliser SQLite avec le fichier `manoir-backend\database\database.sqlite`.
4. Lancer Laravel sur le port `8000`.
5. Lancer Next.js sur le port `3000`.
