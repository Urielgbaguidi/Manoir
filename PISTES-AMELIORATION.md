# Le Manoir — Pistes d'amélioration

_Feuille de route des évolutions restantes, priorisées Impact × Effort (S ≈ heures, M ≈ 1-3 j, L ≈ chantier)._
_Issu de l'inspection fonctionnelle complète du 2026-07-19, révisé par l'audit du 2026-08-18 et le test de parcours du 2026-08-19._
_Les items déjà traités sont dans [RECAP-TRAVAUX.md](RECAP-TRAVAUX.md)._

---

## 🧪 État du parcours client — testé de bout en bout le 2026-08-19

_Parcours réellement exécuté sur l'API en local, pas une lecture de code._

### Ce qu'un client peut faire aujourd'hui

| Étape | État |
|---|---|
| Naviguer, voir les appartements, vérifier une disponibilité | ✅ |
| S'inscrire, se connecter | ✅ multi-appareils depuis la migration Sanctum |
| Mot de passe oublié, confirmer son adresse email | ✅ |
| Faire une demande de réservation | ✅ appartement attribué automatiquement |
| Attendre la validation admin, recevoir la notification | ✅ |
| Télécharger bon et facture | ✅ PDF de 925 Ko généré |
| Annuler, demander une prolongation | ✅ |

La mécanique métier tient debout : statuts, documents, notifications, annulations.

### Ce qu'il ne peut pas faire

- **Payer réellement.** `payment_url` pointe vers `https://payment.manoir.com` — vérifié : **ce domaine n'existe pas**. Aucun prestataire n'est branché.
- **Réserver pour le jour même.** Testé : le formulaire accepte, l'admin reçoit `422 — La date d'arrivée est déjà atteinte`, le client voit `EXPIRÉE` et ne peut plus payer.

### ⚠️ Le scénario de fraude, démontré en trois commandes

Le danger n'est pas le paiement simulé seul, mais sa combinaison avec la formule de caution :

```text
1. Réservation 2 Chambres, 2 nuits, dans 40 jours
   -> Séjour  :      170 000 FCFA
   -> Caution :   12 000 000 FCFA   (40 jours x 300 000)

2. curl anonyme sur le webhook, sans token ni signature
   -> {"status":"success"}
   -> Réservation CONFIRMÉE, facture FAC-2026-00001 émise

3. Annulation immédiate
   -> "Montant à rembourser : 12 000 000 FCFA"
   -> L'admin clique "marquer remboursé" : accepté
```

**Le client n'a versé aucun franc.** Le système lui reconnaît pourtant une créance de 12 millions, bon d'annulation à l'appui. Si l'administrateur fait confiance au document et effectue le virement, l'argent part réellement.

Ces trois étapes ont été exécutées sur l'API, elles ne sont pas théoriques.

### Ordre de traitement

**Avant toute mise en ligne — non négociable**
1. Paiement réel (FedaPay ou KKiaPay) avec webhook signé, et retrait de l'appel webhook du navigateur
2. Formule de caution — **en attente d'une décision métier**
3. Tarifs cohérents — **en attente d'une décision métier**

**Ensuite, par ordre d'utilité**
4. Réservation le jour même
5. Endpoint de prix autoritatif, puis branchement des prix saisonniers (code déjà écrit, jamais appelé)
6. Factures générées côté serveur, numérotation séquentielle
7. Expéditeur email sur le domaine du site avec DKIM
8. SEO, calendrier de disponibilité, avis clients, anglais

### Détail relevé pendant le test

L'inscription prend **7 secondes** : l'envoi du mail de confirmation est synchrone. À basculer en file d'attente — c'est long pour un client qui attend devant son écran.

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

### 4. ~~Authentification Sanctum~~ ✅ FAIT (2026-08-18)
Migré vers Laravel Sanctum 4.3. Multi-appareils, révocation par session, tokens nommés d'après l'appareil. Frontend inchangé. Voir [RECAP-TRAVAUX.md](RECAP-TRAVAUX.md) section 6.

### 5. ~~Vérification d'email~~ ✅ FAIT (2026-08-18)
Lien signé, page de confirmation, bannière de renvoi, mails réels via Brevo. Le **mot de passe oublié**, absent du projet et même de cette liste, a été livré au passage.
⚠️ Aucune action n'est bloquée tant que l'email n'est pas confirmé — le gating reste à décider.

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

## 🔴 Ajouts de l'audit du 2026-08-18

### Formule de caution absurde (Impact : critique - Effort : S)
La caution est calculée `jours_avant_arrivée × deposit_per_day`, en back **et** en front. Réservation test : 2 nuits à 170 000 F → caution de **4 600 000 F**. Plus le client anticipe, plus il paie.
→ Décider la vraie règle métier (forfait ? nuits × tarif ? % du séjour ?) puis corriger back et front ensemble.

### Trois sources de prix contradictoires (Impact : fort - Effort : S)
README (2 Ch. à 35 000 F), `RoomSeeder` (118 000 F, la base réelle) et `lib/roomCategories.ts` (copie en dur côté front) se contredisent. En base, un 2 Chambres coûte **3x le prix d'un VIP** — incohérent.
→ Faire trancher les vrais tarifs, rendre la base seule autoritative, vider le fallback front.

### Réservation le jour même impossible (Impact : moyen - Effort : S)
Le formulaire accepte `check_in` = aujourd'hui (`after_or_equal:today`), mais `expireOverduePaymentRequests` passe en `EXPIREE` toute demande dont `check_in <= aujourd'hui`. L'admin valide, la demande meurt avant que le client puisse payer.

---

## 🟢 Quick wins restants (S)

- **Perf** : la page réservations re-rend **chaque seconde** (`setNowMs(Date.now())`) → isoler le compte à rebours dans un composant dédié.
- **`RoomController::getRooms`** avec dates fait `Room::all()->filter(...)` (O(chambres)) → une requête SQL unique.
- **`AdminReservationController`** : brancher recherche/pagination **côté serveur** (aujourd'hui côté client sur ≤ 200) quand le volume grandira.
- **Numéro WhatsApp** réel à renseigner (placeholder actuel).

---

## Ordre recommandé (révisé le 2026-08-19)

**Bloqué sur une décision métier — à trancher avec le propriétaire**
1. **Formule de caution** : forfait fixe par catégorie ? nuits × tarif ? pourcentage du séjour ?
2. **Tarifs réels par nuit** : ceux du README, ceux de la base, ou d'autres ?

Ces deux réponses débloquent les corrections les plus rentables du projet (effort S, impact critique).

**Technique, dans cet ordre**
3. **Paiement réel** — prérequis absolu à toute mise en production.
4. **Réservation le jour même** — correctif court.
5. **Endpoint de prix autoritatif** puis branchement de `getPriceForDates`.
6. **Factures serveur** avec numérotation séquentielle.
7. **Expéditeur email sur le domaine du site** avec DKIM, avant l'ouverture au public.
8. Produit : avis dynamiques, calendrier de disponibilité, i18n, selon priorité business.
9. SEO, fiabilité réseau et accessibilité en continu.

~~#4 Sanctum~~ et ~~#5 vérification d'email~~ sont faits (2026-08-18).
