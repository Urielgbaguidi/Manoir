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

## 5) Emails — Brevo

Les mails de confirmation d'adresse, de mot de passe oublié, de validation et
d'annulation de réservation passent par **Brevo** (palier gratuit : 300 envois/jour).

1. Crée un compte sur [brevo.com](https://www.brevo.com).
2. **Senders, Domains & Dedicated IPs → Senders** : ajoute l'adresse expéditrice
   (ex. `contact@lemanoir.bj`) et valide-la via le mail reçu.
   ⚠️ Un expéditeur non validé fait échouer tous les envois.
3. **SMTP & API → onglet SMTP** : récupère le **Login** (`xxxxxxx@smtp-brevo.com`)
   et génère une **clé SMTP** (`xsmtpsib-...`).
4. Sur Render, renseigne les secrets :
   - `MAIL_USERNAME` = le Login SMTP
   - `MAIL_PASSWORD` = la clé SMTP
   - `MAIL_FROM_ADDRESS` = l'adresse expéditrice validée à l'étape 2
5. Vérifie que `FRONTEND_URL` est bien renseignée : c'est elle qui construit les
   liens cliquables dans les mails (réinitialisation, confirmation d'adresse).

6. **Blocage d'IP** : Brevo active par defaut le blocage des IP non autorisees
   pour les cles SMTP (erreur `525 5.7.1 Unauthorized IP address`).
   Aller dans **Securite > Blocage d'adresses IP non autorisees** et
   **desactiver le blocage pour les cles SMTP**.
   ⚠️ Ne pas se contenter d'autoriser une IP : les IP de sortie de Render ne sont
   ni fixes ni connues a l'avance, l'autorisation par IP est donc inutilisable
   en production.

> Pour couper tous les envois sans rien casser, mettre `MAIL_MAILER=log`.

### Deliverabilite — a traiter avant l'ouverture au public

Un expediteur sur un domaine Freemail (`@gmail.com`, `@yahoo.fr`...) ne peut porter
ni DKIM ni DMARC. Gmail, Yahoo et Microsoft filtrent de plus en plus ces envois
faits via un tiers : les mails de reservation risquent d'arriver en spam.

Pour la mise en production : utiliser un expediteur sur le domaine du site
(ex. `contact@lemanoir.bj`), l'authentifier dans Brevo et publier les
enregistrements DKIM/DMARC chez le registrar du domaine.

---

## 6) Agendas Google — synchronisation des disponibilités

Les réservations prises par téléphone sont notées dans Google Agenda, **un agenda
par appartement**. Le site les importe pour ne jamais louer un logement déjà occupé.

1. Dans Google Agenda → ⚙️ **Settings** → sélectionner chaque agenda →
   **Integrate calendar** → copier **Secret address in iCal format**.
2. Sur Render, renseigner `GOOGLE_CALENDAR_ICAL_1` à `..._8`, plus
   `GOOGLE_CALENDAR_ICAL_GENERAL` pour l'agenda « LE MANOIR ».
   ⚠️ Ces adresses donnent accès en lecture à tout l'agenda : ce sont des secrets.
3. Générer un jeton et le mettre dans `CALENDAR_SYNC_TOKEN` (par exemple
   `php artisan tinker --execute="echo Str::random(43);"`).

### Déclencher la synchronisation

Le plan gratuit Render **ne fournit pas de tâches planifiées** : la planification
Laravel (`Schedule::command('calendar:sync')`) ne s'exécute donc jamais en
production. Deux mécanismes la remplacent.

**Automatique, sans rien installer.** Quand les données ont plus de 15 minutes,
la consultation suivante resynchronise **les huit agendas**, après l'envoi de la
réponse. Ils sont téléchargés en parallèle : l'attente se résume au plus lent.

Mesuré en local : contenu servi en 0,4 s, connexion libérée à 2,8 s pendant la
synchronisation, puis 0,5 s pour les visites suivantes. Séquentiellement, la même
opération prenait 9 secondes — ce qui aurait bloqué le site, le serveur de
production ne traitant qu'une requête à la fois.

**Cron externe, recommandé en plus.** Un service gratuit comme
[cron-job.org](https://cron-job.org) appelle toutes les 10 minutes :

```
POST https://VOTRE-API.onrender.com/api/calendar/sync
En-tête : X-Calendar-Sync-Token: <CALENDAR_SYNC_TOKEN>
```

Cela synchronise **tous** les agendas d'un coup, et maintient le service Render
éveillé — il s'endort sinon après quinze minutes d'inactivité.

> Sans `CALENDAR_SYNC_TOKEN`, cette route répond 404 : elle n'existe pas.

### En local

```powershell
php artisan calendar:sync          # synchronisation manuelle
php artisan calendar:sync --check  # + contrôle de l'agenda « LE MANOIR »
php artisan schedule:work          # active la planification toutes les 15 min
```

---

## 7) Agendas Google — écriture des réservations du site

Sens inverse du précédent : quand un client paie son acompte, la réservation
apparaît dans l'agenda de l'appartement. Sans cela, l'équipe pourrait relouer la
même période par téléphone.

La lecture se contente d'une adresse iCal ; l'écriture exige une véritable
identité Google. C'est le rôle du **compte de service** : un compte sans mot de
passe ni boîte mail, qui s'authentifie avec une clé privée.

1. **Google Cloud Console** → créer un projet → **API et services** → activer
   **Google Calendar API**.
2. **IAM et administration** → **Comptes de service** → en créer un (aucun rôle
   à lui donner : les droits viennent du partage d'agenda, pas d'IAM).
3. Onglet **Clés** → **Ajouter une clé** → **Créer une clé** → **JSON**. Le
   fichier se télécharge une seule fois et ne peut pas être retéléchargé.
4. Dans **Google Agenda**, pour chacun des 8 appartements :
   ⋮ → **Paramètres et partage** → **Ajouter des personnes** → coller l'adresse
   du compte de service (`...iam.gserviceaccount.com`) → autorisation
   **Apporter des modifications aux événements**.
   L'agenda « LE MANOIR » n'a pas besoin d'être partagé : le site n'y écrit
   jamais.
5. Renseigner `GOOGLE_CALENDAR_ID_1` à `..._8` (Paramètres de l'agenda →
   « ID de l'agenda »).
6. Déposer le fichier JSON :
   - en local, dans `manoir-backend/storage/google-calendar.json` (déjà ignoré
     par git) ;
   - sur Render, en **Secret File**, puis pointer `GOOGLE_CALENDAR_CREDENTIALS`
     sur son chemin.

> ⚠️ Cette clé donne le droit de modifier les agendas. Elle ne doit jamais entrer
> dans le dépôt : Google désactive automatiquement les clés détectées dans un
> dépôt public.

### Ce que le site écrit, et quand

| Événement | Action dans l'agenda |
|---|---|
| Acompte payé (réservation `CONFIRMEE`) | Création de l'événement |
| Prolongation acceptée par l'admin | Modification de la date de fin |
| Réservation annulée | Suppression de l'événement |

Une simple demande non payée n'écrit rien : elle resterait en travers de
l'agenda sans jamais devenir un séjour.

Titre : `Site - Nom du client - N nuitees`. Le préfixe distingue d'un coup d'œil
ce qui vient du site de ce qui a été saisi à la main ; il se change avec
`GOOGLE_CALENDAR_WRITE_PREFIX`. La description porte téléphone, e-mail et
numéro de réservation.

**Convention de dates.** L'agenda du Manoir marque le jour du départ comme
occupé, alors que le site libère cette nuit-là. L'écriture applique donc
`end.date = départ + 1 jour`, exactement l'inverse de ce que retranche l'import.

**Pas de double blocage.** Chaque réservation retient l'UID de l'événement créé.
La synchronisation suivante retrouve cet UID dans le flux iCal et l'ignore :
sans ce garde-fou, l'appartement serait bloqué deux fois pour le même séjour, et
le blocage survivrait à l'annulation.

**Si Google tombe.** L'échec est journalisé, jamais propagé : un client qui a
payé voit sa réservation confirmée même si l'agenda est injoignable. Sans clé de
compte de service, l'écriture est simplement inactive et le site fonctionne
comme avant.

---

## Récapitulatif des variables

| Service | Variable | Valeur |
|---|---|---|
| Render | `APP_KEY` | `base64:...` (généré) |
| Render | `DB_HOST/DB_DATABASE/DB_USERNAME/DB_PASSWORD` | depuis Neon (pooled) |
| Render | `APP_URL` | URL Render |
| Render | `FRONTEND_URL` | URL Vercel |
| Vercel | `NEXT_PUBLIC_API_URL` | `URL_Render/api` |
| Render | `MAIL_USERNAME` | Login SMTP Brevo |
| Render | `MAIL_PASSWORD` | Clé SMTP Brevo (`xsmtpsib-...`) |
| Render | `MAIL_FROM_ADDRESS` | Expéditeur validé dans Brevo |
| Render | `GOOGLE_CALENDAR_ICAL_1..8` | Adresses iCal secrètes des appartements |
| Render | `GOOGLE_CALENDAR_ICAL_GENERAL` | Adresse iCal de l'agenda « LE MANOIR » |
| Render | `CALENDAR_SYNC_TOKEN` | Jeton du déclencheur externe |
| Render | `GOOGLE_CALENDAR_ID_1..8` | Calendar ID des appartements (écriture) |
| Render | `GOOGLE_CALENDAR_CREDENTIALS` | Chemin du Secret File de la clé du compte de service |
| Render | `GOOGLE_CALENDAR_WRITE` | `true` par défaut ; `false` coupe l'écriture |

## Notes
- **SEO** : le front est en export statique (`output: 'export'`) avec fetch client. Pour un meilleur SEO par appartement, on peut passer Next en rendu natif sur Vercel (retirer `output: 'export'`) — chantier séparé.
- **Domaine custom** : ajoutable côté Vercel (frontend) et Render (API) une fois en place.
- Voir aussi [PISTES-AMELIORATION.md](PISTES-AMELIORATION.md) (dont le **paiement réel**, prérequis avant prod).
