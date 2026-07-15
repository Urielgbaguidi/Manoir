# Le Manoir - Backend

API Laravel de la plateforme Le Manoir.

Elle gere :

- utilisateurs,
- authentification par token API,
- categories d'appartements,
- appartements,
- disponibilites,
- reservations,
- paiements internes,
- documents,
- annulations,
- administration.

## Technologies

- PHP 8.3+
- Laravel 13
- Composer
- SQLite pour le developpement local
- MySQL possible en production selon l'hebergeur
- DomPDF installe via `barryvdh/laravel-dompdf`

## Installation locale

Le backend utilise SQLite en local. Si le fichier n'existe pas apres telechargement du projet, il faut le creer dans `database/database.sqlite`.

```powershell
composer install
if (!(Test-Path .env)) { copy .env.example .env }
if (!(Test-Path database\database.sqlite)) { New-Item -ItemType File database\database.sqlite | Out-Null }
php artisan key:generate
php artisan migrate
php artisan db:seed --class=UserSeeder
php artisan db:seed --class=RoomSeeder
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

Configuration locale attendue dans `.env` :

```env
APP_URL=http://localhost:8000
DB_CONNECTION=sqlite
```

API locale :

```text
http://localhost:8000/api
```

## Comptes de test

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

## Modeles principaux

- `User`
- `Room`
- `RoomCategory`
- `Reservation`
- `Payment`
- `Notification`
- `SeasonalPrice`

## Categories et appartements

| Categorie | Appartements | Prix par nuit | Caution par jour |
| --- | --- | ---: | ---: |
| VIP 3 | Numero 3 | 30 000 FCFA | 500 000 FCFA |
| VIP 7 | Numero 7 | 40 000 FCFA | 500 000 FCFA |
| 2 Chambres | Numeros 2, 4, 6, 8 | 118 000 FCFA | 300 000 FCFA |
| 1 Chambre | Numeros 1, 5 | 85 000 FCFA | 200 000 FCFA |

## Routes publiques principales

```text
POST /api/register
POST /api/login
GET  /api/rooms
GET  /api/rooms/{slug}
POST /api/rooms/{slug}/check-availability
GET  /api/room-categories
GET  /api/room-categories/{category}
POST /api/room-categories/{category}/check-availability
```

## Routes client protegees

```text
POST /api/logout
GET  /api/user
PUT  /api/user/profile
PUT  /api/user/password
POST /api/reservations
GET  /api/reservations
GET  /api/reservations/{id}
GET  /api/reservations/{id}/payments
POST /api/reservations/{id}/invoice-download
POST /api/reservations/{id}/cancel
POST /api/reservations/{id}/extension
POST /api/reservations/{reservationId}/payments/initiate
GET  /api/payments/{paymentId}/status
GET  /api/payments/{paymentId}/invoice
```

## Route webhook paiement

```text
POST /api/payments/{paymentId}/webhook
```

## Routes admin protegees

```text
GET    /api/admin/reservations
GET    /api/admin/occupied-rooms
POST   /api/admin/reservations/{id}/approve
POST   /api/admin/reservations/{id}/reject
POST   /api/admin/reservations/{id}/release-room
POST   /api/admin/reservations/{id}/mark-refunded
POST   /api/admin/reservations/{id}/extension/approve
POST   /api/admin/reservations/{id}/extension/reject
POST   /api/admin/reservations/check-conflicts
GET    /api/admin/room-categories
PUT    /api/admin/room-categories/{category}
POST   /api/admin/room-categories/{category}/media
GET    /api/admin/rooms
POST   /api/admin/rooms
GET    /api/admin/rooms/{room}
PUT    /api/admin/rooms/{room}
DELETE /api/admin/rooms/{room}
POST   /api/admin/rooms/{room}/media
GET    /api/admin/stats
GET    /api/admin/users
PUT    /api/admin/users/{id}
PUT    /api/admin/users/{id}/toggle-admin
DELETE /api/admin/users/{id}
```

## Statuts de reservation

| Statut | Role |
| --- | --- |
| `EN_ATTENTE` | Demande envoyee |
| `VALIDEE_PAIEMENT_REQUIS` | Demande acceptee, caution de réservation a payer sous 24h |
| `CONFIRMEE` | Caution payee |
| `REFUSEE` | Demande refusee |
| `EXPIREE` | Delai de paiement depasse, appartement libere |
| `SEJOUR_PAYE` | Frais de sejour payes |
| `ANNULEE` | Reservation annulee |
| `REMBOURSEE` | Remboursement effectue |
| `LIBEREE` | Occupation terminee par l'administrateur, appartement disponible |

## Reservation et occupation

La periode de reservation correspond a l'intervalle entre la date de demande et la date d'arrivee.

L'occupation d'un appartement correspond a l'intervalle entre la date d'arrivee et la date de depart.

Une annulation client est autorisee uniquement avant la date d'arrivee. A partir du jour d'arrivee, la periode de reservation est terminee, l'occupation reelle commence et l'API refuse l'annulation.

Le back-office expose `GET /api/admin/occupied-rooms` pour lister uniquement les appartements actuellement occupes. Une reservation est consideree comme une occupation en cours si :

- son statut est `CONFIRMEE` ou `SEJOUR_PAYE`,
- la date d'arrivee est atteinte,
- la date de depart n'est pas encore atteinte.

`POST /api/admin/reservations/{id}/release-room` permet a l'administrateur de liberer une occupation en cours. La reservation passe au statut `LIBEREE`, les champs `released_at`, `released_by_admin_id` et `release_notes` conservent l'historique, et l'appartement n'est plus pris en compte dans les conflits de disponibilite.

## Expiration des cautions

Quand une demande est acceptee par l'administrateur, `payment_deadline` est fixe a 24h apres la validation.

Pendant ce delai, l'appartement attribue est considere comme bloque pour les dates de la reservation.

Si le client ne paie pas la caution avant la fin du delai, ou si la date d'arrivee est atteinte avant le paiement :

- la reservation passe au statut `EXPIREE`,
- elle n'est plus prise en compte dans les conflits de disponibilite,
- l'appartement est automatiquement disponible pour les autres clients,
- le bouton de paiement de caution est desactive dans l'espace client.

Le backend expire les demandes depassees lors des appels API importants, et la commande suivante permet aussi de traiter les expirations et les relances en arriere-plan :

```bash
php artisan reservations:check-expirations
```

## Prolongation de sejour

Une reservation peut recevoir une demande de prolongation uniquement si :

- son statut est `CONFIRMEE`,
- le sejour a deja commence,
- au moins une journee du sejour est deja passee,
- le sejour n'est pas encore paye,
- aucune demande de prolongation n'est deja en attente.

Le client envoie une nouvelle date de depart via `POST /api/reservations/{id}/extension`.

Le backend verifie que le meme appartement reste disponible entre l'ancienne date de depart et la nouvelle date demandee.

Cote administrateur :

- `POST /api/admin/reservations/{id}/extension/approve` accepte la prolongation, met a jour `check_out` et recalcule `stay_amount`.
- `POST /api/admin/reservations/{id}/extension/reject` rejette la prolongation avec un motif obligatoire.

Les champs `extension_status`, `extension_previous_check_out`, `extension_requested_check_out`, `extension_requested_at`, `extension_processed_at` et `extension_admin_notes` conservent l'historique de la demande.

## Paiement actuel

Le backend cree les paiements et met a jour les reservations via les routes de paiement.

L'interface client utilise ce flux pour valider le paiement dans le site et afficher le message de succes. Les fournisseurs acceptes dans la validation API sont :

```text
fedapay
kkiapay
```

Aucun fichier de secret de paiement ne doit etre ajoute au depot.

## Medias

Les medias uploades par l'administration sont stockes dans :

```text
storage/app/public/room-categories
```

La commande suivante est necessaire pour les servir publiquement :

```bash
php artisan storage:link
```

## Verification

```bash
php artisan test
vendor/bin/pint --test
php artisan route:list
php artisan reservations:check-expirations
```
