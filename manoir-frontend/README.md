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
| `/rooms/appartement-vip` | Selection VIP 3 / VIP 7 |
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
8. Si la demande est validee, le client a 24h maximum pour payer la caution de réservation dans le site.
9. Si le delai de 24h expire, ou si la date d'arrivee est atteinte avant paiement, le bouton de paiement de caution est desactive et la reservation passe dans l'historique.
10. Apres paiement de la caution, le client peut consulter ses documents et payer le sejour.
11. Si le sejour a commence depuis au moins une journee et que le sejour n'est pas encore paye, le client peut demander une prolongation depuis son espace client.
12. L'administrateur accepte ou rejette la prolongation. Si elle est acceptee, la date de depart et le montant du sejour sont recalcules automatiquement.
13. Le client peut annuler une reservation lorsque le statut l'autorise, uniquement avant la date d'arrivee.
14. A partir de la date d'arrivee, l'occupation reelle commence et le bouton d'annulation n'est plus affiche.

## Back-office admin

La page `/admin` affiche aussi les appartements occupes actuellement. Cette section ne liste pas les simples demandes de reservation : elle concerne uniquement les sejours entre la date d'arrivee et la date de depart.

Pour chaque appartement occupe, l'administrateur voit :

- le client occupant,
- l'email et le telephone du client,
- la date de demande,
- la date d'arrivee,
- la date de depart prevue,
- la duree du sejour,
- le statut.

L'administrateur peut liberer l'appartement. Dans ce cas, la reservation passe au statut `LIBEREE`, quitte les reservations actives du client et l'appartement redevient disponible.

## Documents client

Les documents de caution de reservation affichent uniquement la date de demande et la date d'arrivee du client.

La facture de caution affiche aussi la date et l'heure de delivrance de la facture.

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
