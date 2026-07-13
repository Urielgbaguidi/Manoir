# Le Manoir - Frontend

Application Next.js de la plateforme Le Manoir.

Elle contient :

- page d'accueil,
- guide "Comment reserver ?",
- catalogue des appartements,
- pages detail des categories et appartements VIP,
- inscription et connexion,
- espace client,
- gestion du profil client,
- documents client,
- interface administrateur.

## Technologies

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React

## Structure

```text
manoir-frontend/
+-- app/
|   +-- page.tsx
|   +-- comment-reserver/
|   +-- rooms/
|   +-- reservations/
|   +-- espace-client/
|   +-- auth/
|   +-- admin/
|   +-- invoices/
+-- components/
|   +-- home/
|   +-- layout/
|   +-- rooms/
|   +-- ui/
+-- context/
+-- lib/
+-- public/assets/
```

## Installation locale

```bash
npm ci
if (!(Test-Path .env.local)) { copy .env.example .env.local }
npm run dev
```

Le site local est disponible sur :

```text
http://localhost:3000
```

## Variables d'environnement

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Manoir
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Pages principales

| Route | Role |
| --- | --- |
| `/` | Accueil |
| `/comment-reserver` | Documentation client du processus de reservation |
| `/rooms` | Catalogue des appartements |
| `/rooms/appartement-vip` | Selection VIP 1 / VIP 2 |
| `/rooms/appartement-2-chambres` | Detail categorie 2 Chambres |
| `/rooms/appartement-1-chambre` | Detail categorie 1 Chambre |
| `/auth/login` | Connexion |
| `/auth/register` | Inscription |
| `/espace-client` | Suivi des reservations client |
| `/espace-client/profil` | Gestion du profil client |
| `/reservations` | Page de suivi des reservations |
| `/reservations/[id]/invoice` | Documents reservation/factures |
| `/invoices/[paymentId]` | Consultation d'une facture de paiement |
| `/admin` | Tableau de bord administrateur |
| `/admin/rooms` | Gestion des appartements et medias |
| `/admin/users` | Gestion des utilisateurs |

## Flux client actuel

1. Le client consulte le catalogue.
2. Il choisit une categorie ou un appartement VIP.
3. Il lance une demande de reservation.
4. Il s'inscrit ou se connecte.
5. Il saisit les dates et les demandes speciales.
6. La demande apparait dans son espace client.
7. L'administrateur valide ou refuse.
8. Si la demande est validee, le client paie la caution dans le site.
9. Le client peut consulter ses documents et payer le sejour.
10. Le client peut annuler une reservation lorsque le statut l'autorise.

## Medias frontend

Les images publiques utilisees par l'accueil et les galeries de secours sont dans :

```text
public/assets
```

## Verification

```bash
npm run lint
npm run build
```
