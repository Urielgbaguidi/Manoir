# Le Manoir — Pistes d'amélioration

_Feuille de route des évolutions restantes, priorisées Impact × Effort (S ≈ heures, M ≈ 1-3 j, L ≈ chantier)._
_Issu de l'inspection fonctionnelle complète du 2026-07-19. Les items déjà traités sont dans [RECAP-TRAVAUX.md](RECAP-TRAVAUX.md)._

---

## 🔴 Bloquant avant mise en production

### 1. Paiement 100 % simulé + webhook non signé (Impact : critique · Effort : L)
`app/reservations/page.tsx` appelle `initiatePayment` puis **poste directement `status:'success'` sur le webhook depuis le navigateur**. Le webhook (`routes/api.php` → `PaymentController::webhook`) est **public et ne vérifie aucune signature** ; `payment_url` est un placeholder.
→ **N'importe qui peut confirmer une caution/un séjour gratuitement.** Intégrer réellement un prestataire (FedaPay / KKiaPay) : redirection de paiement, **webhook signé (vérif HMAC)**, montant recoupé côté serveur, et **retirer tout appel webhook du front**.

---

## 🟠 Fort impact — chantiers structurants

### 2. Endpoint de prix autoritatif + tarif week-end / saison (M)
`Room::getPriceForDates` (week-end +20 %, prix saisonniers) **existe mais n'est jamais utilisé** ; le séjour est un simple `nuits × base_price`. Le brancher tel quel créerait un **écart prix affiché (front) ≠ prix facturé (back)** car le front ne connaît pas les prix saisonniers en base.
→ Créer un **endpoint de prix** (par catégorie/chambre + dates) renvoyant le montant autoritatif ; le front l'utilise pour l'affichage ; le back l'utilise à la création. Ensuite, brancher `getPriceForDates`.

### 3. Facturation autoritative serveur (M)
Le **numéro de facture et le PDF sont générés côté client** (`reservations/page.tsx`), donc non séquentiels et potentiellement divergents. Un `InvoiceController` autoritatif existe déjà mais n'est pas utilisé pour le téléchargement.
→ Générer numéro (table de séquence) + PDF côté serveur ; le front télécharge le document serveur.

### 4. Authentification Sanctum (M/L)
Token « maison » (un seul `sha256` par user, une nouvelle connexion invalide les autres appareils, stocké en `localStorage`). L'**expiration** a été ajoutée (gain immédiat), mais pour du multi-appareils / révocation / refresh propres → **migrer vers Laravel Sanctum**.

### 5. Vérification d'email (M)
`email_verified_at` existe mais **aucune vérification n'est branchée**.
→ Flux d'email de confirmation (envoi + lien signé + gating des actions sensibles).

---

## 🟡 Impact moyen

### 6. Internationalisation FR / EN (L)
Touristes anglophones fréquents. → i18n (next-intl ou équivalent) sur **toutes les chaînes de toutes les pages**. Vrai chantier transverse.

### 7. Calendrier de disponibilité visuel (M)
Fiche appartement : calendrier mensuel montrant jours libres/occupés.
→ Nécessite un **endpoint de disponibilité par jour** (le back ne fait aujourd'hui que par plage) + composant calendrier.

### 8. Avis clients dynamiques (M)
La section témoignages est aujourd'hui **statique** (données en dur).
→ Modèle + migration + `ReviewController` (soumission, modération admin) + affichage dynamique + note moyenne.

### 9. SEO pour l'export statique (M)
`output: export` + fiches `/rooms/[slug]` chargées **côté client** = coquilles vides pour les crawlers, pas d'Open Graph par appartement, images `unoptimized`.
→ Metadata statiques + OG par appartement (via `generateStaticParams` + données au build), ou rendu serveur/ISR si l'hébergement le permet.

### 10. Fiabilité réseau front (M)
`lib/api.ts` `request()` : ni timeout, ni retry, ni distinction erreur réseau/offline. Le flux de paiement peut afficher « échec » alors que le serveur a confirmé.
→ Timeout + retry idempotents + polling `getPaymentStatus` + messages offline.

### 11. Accessibilité (finitions) (S)
Modale admin (`admin/page.tsx`) sans **piège de focus** ni restauration de focus ni fermeture `Échap` (la modale vidéo, elle, le fait — bon modèle à répliquer).

---

## 🟢 Quick wins restants (S)

- **Règle de caution — donnée** : `deposit_per_day` VIP à **500 000 F** pour un séjour à 30 000 F/nuit reste élevé (donnée, pas formule) — à confirmer/ajuster.
- **Perf** : la page réservations re-rend **chaque seconde** (`setNowMs(Date.now())`) → isoler le compte à rebours dans un composant dédié.
- **`RoomController::getRooms`** avec dates fait `Room::all()->filter(...)` (O(chambres)) → une requête SQL unique.
- **`AdminReservationController`** : brancher recherche/pagination **côté serveur** (aujourd'hui côté client sur ≤ 200) quand le volume grandira.
- **Numéro WhatsApp** réel à renseigner (placeholder actuel).

---

## Ordre recommandé
1. **#1 Paiement réel** (prérequis absolu à toute mise en production).
2. **#2 Endpoint de prix autoritatif** (débloque tarif saison + cohérence).
3. **#3 Factures serveur** puis **#4 Sanctum**.
4. Produit : **#8 avis dynamiques**, **#7 calendrier**, **#6 i18n** selon priorité business.
5. **#9 SEO** + **#10/#11** fiabilité/accessibilité en continu.
