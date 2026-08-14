# Déploiement — Le Manoir

Stack : **Vercel** (frontend Next.js) · **Render** (API Laravel, Docker) · **Neon** (base Postgres).

Fichiers fournis : `manoir-frontend/vercel.json`, `render.yaml`, `manoir-backend/Dockerfile`, `manoir-backend/.dockerignore`, `manoir-backend/config/cors.php`.

---

## 1) Base de données — Neon

1. Crée un projet sur [neon.tech](https://neon.tech) (région Europe/Frankfurt de préférence).
2. Récupère la **Connection string** — prends la version **pooled** (l'hôte contient `-pooler`), ex :
   `postgresql://USER:PASSWORD@ep-xxx-pooler.eu-central-1.aws.neon.tech/DBNAME?sslmode=require`
3. Note : `DB_HOST` = `ep-xxx-pooler...neon.tech`, `DB_DATABASE` = `DBNAME`, `DB_USERNAME` = `USER`, `DB_PASSWORD` = `PASSWORD`.

---

## 2) Backend — Render (Blueprint)

1. Pousse le repo sur GitHub.
2. Render → **New → Blueprint** → sélectionne le repo → il détecte `render.yaml`.
3. Renseigne les variables `sync: false` (secrets) dans le dashboard :
   - `APP_KEY` → générer en local : `php artisan key:generate --show` puis coller la valeur `base64:...`
   - `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` → depuis Neon (étape 1)
   - `APP_URL` → laisser vide pour l'instant (à remplir avec l'URL Render après le 1er déploiement)
   - `FRONTEND_URL` → laisser vide (rempli à l'étape 4 avec l'URL Vercel)
4. Déploie. Le `preDeployCommand` joue **`php artisan migrate --force`** automatiquement.
5. (Optionnel, 1re fois) pour insérer les chambres/catégories de démo, ouvre le **Shell** du service Render et lance : `php artisan db:seed --force`.
6. Récupère l'URL de l'API (ex : `https://manoir-api.onrender.com`) → renseigne-la dans `APP_URL`.

> ⚠️ Plan gratuit Render : le service **s'endort après ~15 min** d'inactivité (1re requête lente). Health check : `/up`.

---

## 3) Frontend — Vercel

1. Vercel → **Add New → Project** → importe le repo.
2. **Root Directory** = `manoir-frontend`.
3. Variable d'environnement (Production **et** Preview) :
   - `NEXT_PUBLIC_API_URL` = `https://manoir-api.onrender.com/api` (l'URL Render + `/api`)
4. Déploie. `vercel.json` gère déjà le routing des pages dynamiques (`/rooms/:slug`, factures).
5. Récupère l'URL Vercel (ex : `https://le-manoir.vercel.app`).

> 💡 `NEXT_PUBLIC_API_URL` est injectée **au build** (export statique). Si tu la changes, **redeploie** le front.

---

## 4) Relier les deux (CORS)

1. Sur **Render**, mets `FRONTEND_URL` = l'URL Vercel (ex : `https://le-manoir.vercel.app`) → **redeploie** l'API.
   - `config/cors.php` autorise déjà `FRONTEND_URL` + tous les `*.vercel.app` (previews compris).
2. Teste : ouvre le site Vercel → connexion / réservation doivent passer (plus d'erreur CORS).

---

## Récapitulatif des variables

| Service | Variable | Valeur |
|---|---|---|
| Render | `APP_KEY` | `base64:...` (généré) |
| Render | `DB_HOST/DB_DATABASE/DB_USERNAME/DB_PASSWORD` | depuis Neon (pooled) |
| Render | `APP_URL` | URL Render |
| Render | `FRONTEND_URL` | URL Vercel |
| Vercel | `NEXT_PUBLIC_API_URL` | `URL_Render/api` |

## Notes
- **SEO** : le front est en export statique (`output: 'export'`) avec fetch client. Pour un meilleur SEO par appartement, on peut passer Next en rendu natif sur Vercel (retirer `output: 'export'`) — chantier séparé.
- **Domaine custom** : ajoutable côté Vercel (frontend) et Render (API) une fois en place.
- Voir aussi [PISTES-AMELIORATION.md](PISTES-AMELIORATION.md) (dont le **paiement réel**, prérequis avant prod).
