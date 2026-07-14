# Le Manoir - Plateforme de reservation d'appartements

Le Manoir est une plateforme web complete pour presenter des appartements, recevoir des demandes de reservation, gerer les validations administrateur, suivre les paiements et fournir les documents client.

Le projet contient deux applications :

- `manoir-frontend` : interface client et administrateur en Next.js.
- `manoir-backend` : API Laravel, base de donnees, reservations, paiements, documents et administration.

## Structure du projet

```text
Manoir/
+-- manoir-frontend/       # Application Next.js
|   +-- app/               # Pages App Router
|   +-- components/        # Composants UI
|   +-- context/           # Authentification et notifications visuelles
|   +-- lib/               # Client API et donnees de categories
|   +-- public/assets/     # Images publiques du site
|
+-- manoir-backend/        # API Laravel
|   +-- app/               # Controllers, Models, Mail, Middleware
|   +-- database/          # Migrations, factories, seeders
|   +-- routes/api.php     # Routes API
|   +-- storage/app/public # Medias uploades depuis l'administration
|
+-- README.md
+-- INSTALL.md
+-- MISE_EN_LIGNE.md
```

## Fonctionnalites actuelles

### Site public

- Page d'accueil Le Manoir avec navigation, section presentation et acces rapides.
- Page "Comment reserver ?" expliquant le processus de reservation.
- Catalogue des appartements avec 3 categories :
  - Appartement VIP
  - Appartement 2 Chambres
  - Appartement 1 Chambre
- Page intermediaire VIP avec deux appartements distincts :
  - VIP 1, appartement numero 3
  - VIP 2, appartement numero 7
- Pages detail avec galerie photos, videos, description, prix, caution et bouton de reservation.

### Structure des appartements

| Categorie | Appartements | Prix par nuit | Caution par jour |
| --- | --- | ---: | ---: |
| VIP 1 | Numero 3 | 30 000 FCFA | 500 000 FCFA |
| VIP 2 | Numero 7 | 40 000 FCFA | 500 000 FCFA |
| 2 Chambres | Numeros 2, 4, 6, 8 | 118 000 FCFA | 300 000 FCFA |
| 1 Chambre | Numeros 1, 5 | 85 000 FCFA | 200 000 FCFA |

Pour les categories 1 Chambre et 2 Chambres, le client voit la categorie et le systeme attribue automatiquement un appartement disponible selon les dates.

### Authentification

- Inscription client avec nom, email, telephone et mot de passe.
- Connexion client.
- Connexion administrateur.
- Espace "Mon espace" pour les clients connectes.
- Gestion du profil client :
  - modification du nom,
  - changement de mot de passe avec verification de l'ancien mot de passe.
- Gestion des utilisateurs cote administrateur.

### Reservations

- Formulaire de demande avec :
  - date d'arrivee,
  - date de depart,
  - demandes speciales.
- Verification de disponibilite.
- Attribution automatique d'un numero d'appartement disponible.
- Calcul de la caution :

```text
Caution = caution par jour x nombre de jours entre la demande et l'arrivee
```

- Calcul du sejour :

```text
Frais sejour = nombre de nuits x prix par nuit
```

- Apres validation par l'administrateur, l'appartement est reserve pour le client pendant 24h.
- Si la caution n'est pas payee dans ce delai :
  - la demande passe automatiquement au statut `EXPIREE`,
  - le bouton de paiement de caution est desactive cote client,
  - l'appartement est libere et redevient disponible pour les autres clients.

### Paiements actuels

Le paiement est gere dans le site sous forme de validation interne. Quand le client clique sur "Payer la caution de réservation" ou "Payer mon sejour", le site affiche le message de succes :

```text
PAIEMENT REUSSI
La transaction a ete validee avec succes.
```

Les routes API de paiement existent et acceptent les fournisseurs `fedapay` et `kkiapay`, mais le depot actuel ne contient pas encore une integration externe active avec KKiaPay.

### Documents

Le client peut consulter ou telecharger selon l'etape :

- Bon de Reservation
- Facture de Caution
- Bon du Sejour
- Facture du Sejour
- Bon d'Annulation

Les documents affichent les informations client, les dates, le numero d'appartement attribue, les montants et les references de facture lorsque disponibles.

### Annulation

Le client peut annuler une reservation lorsque le statut le permet :

- `EN_ATTENTE`
- `VALIDEE_PAIEMENT_REQUIS`
- `CONFIRMEE`

Si la caution a deja ete payee, le systeme calcule le montant retenu et le montant a rembourser.

L'administrateur peut marquer le remboursement comme effectue.

### Administration

L'administration permet de :

- consulter les statistiques,
- voir les demandes de reservation,
- confirmer ou rejeter une demande,
- saisir un motif de rejet,
- marquer un remboursement comme effectue,
- gerer les categories d'appartements,
- ajouter ou supprimer des photos et videos,
- modifier descriptions, prix et cautions,
- bloquer ou debloquer une categorie,
- bloquer ou debloquer VIP 1 et VIP 2,
- gerer les utilisateurs.

## Statuts de reservation

| Statut | Signification |
| --- | --- |
| `EN_ATTENTE` | Demande envoyee, en attente de validation admin |
| `VALIDEE_PAIEMENT_REQUIS` | Demande acceptee, caution de réservation a payer sous 24h |
| `CONFIRMEE` | Caution payee, reservation confirmee |
| `REFUSEE` | Demande refusee par l'administrateur |
| `EXPIREE` | Delai de paiement de caution depasse, appartement libere |
| `SEJOUR_PAYE` | Frais de sejour payes |
| `ANNULEE` | Reservation annulee par le client |
| `REMBOURSEE` | Remboursement confirme par l'administrateur |

## Installation locale

Consulter [INSTALL.md](./INSTALL.md).

En local, le backend utilise SQLite avec le fichier :

```text
manoir-backend/database/database.sqlite
```

Il n'est pas necessaire de creer une base MySQL ni de lancer MySQL dans XAMPP pour tester le projet localement.

## Mise en ligne

Consulter [MISE_EN_LIGNE.md](./MISE_EN_LIGNE.md).

## Comptes de test

Apres execution des seeders :

### Administrateur

```text
Email: admin@manoir.com
Mot de passe: password123
```

### Client

```text
Email: client@test.com
Mot de passe: password123
```

## Verification du projet

Frontend :

```bash
cd manoir-frontend
npm run lint
npm run build
```

Backend :

```bash
cd manoir-backend
php artisan test
vendor/bin/pint --test
```

## Medias

Les medias actuels uploades depuis l'administration sont inclus dans :

```text
manoir-backend/storage/app/public/room-categories
```

Les images publiques du site sont dans :

```text
manoir-frontend/public/assets
```
