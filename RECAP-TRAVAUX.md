# Le Manoir — Récapitulatif des travaux

_Refonte visuelle complète + durcissement fonctionnel du site (frontend Next.js 15 + backend Laravel)._
_Dernière mise à jour : 2026-07-19._

---

## 1. Refonte visuelle — Design system « Liquid Glass »

Passage d'un thème clair crème/serif « plat » à une **expérience sombre chaude et cinématique** avec glassmorphisme avancé (façon iOS), tout en conservant 100 % du contenu, des liens et des fonctionnalités.

### Fondations

- **Typographies** : `Bricolage Grotesque` (titres) + `Inter` (corps) — le serif Cormorant a été retiré (`app/layout.tsx`).
- **Palette nuit chaude & crémeuse** (`tailwind.config.ts`) : `night` `#1A1308`, `night-800/700`, `espresso`, accent **`gold` `#C9A45C` / `gold-light` `#E4C888`**, + olive / terracotta / cream.
- **Système de verre** (`app/globals.css`) : classes réutilisables `.glass` / `.glass-warm` / `.glass-dark` / `.glass-light` (+ `.glass-edge` arête spéculaire, `.glass-hover`, `.glass-input`, `.sheen` balayage lumineux). Utilitaires `.eyebrow`, `.text-gradient-gold/-cream`, `.hairline`.
- **Fond ambiant global** (`components/visual/AmbientBackground.tsx`) : dégradé nuit, aurores lumineuses, **feuillages botaniques SVG** (`BotanicalLeaf.tsx`) et **filigrane du manoir** (`ManorMark.tsx`) inspirés du logo, grain animé.
- **Composants partagés** : `MagneticButton`, `Reveal` (apparition au scroll), `GlassCard`, `LogoSeal` (zoom logo), `ImageLightbox`, `WhatsAppButton`, `ThemeToggle`, `CountryCodeSelect`, `NotificationBell`, `Testimonials`.

### Thème clair / sombre

- **Interrupteur soleil/lune** (`ThemeToggle`) qui écrit `data-theme` sur `<html>` + persistance `localStorage` + script anti-flash (FOUC) dans le `<head>`.
- Thème clair piloté par un bloc d'overrides centralisé sous `:root[data-theme="light"]` ; les sections sur média (hero, footer, cartes-image) portent `.on-dark` et restent sombres dans les deux thèmes.
- Fond ambiant, navbar (fusion transparente), verre, inputs, accents : tout est thème-aware.

### Pages retravaillées (tout le site)

| Zone                                                              | État                                                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Accueil**                                                 | Hero cinématique, bande stats verre, bento de cartes, sanctuaire, suites, **témoignages**, « L'Art de Recevoir », footer signé |
| **Nos appartements** (liste, fiche détail, sélection VIP) | Cartes verre, galerie **lightbox**, formulaire de réservation en verre                                                             |
| **Connexion / Inscription / Comment réserver**             | Cartes verre sombres, or, `glass-input`, **sélecteur d'indicatif custom avec drapeaux**                                          |
| **Espace client / Réservations / Profil**                  | Cartes, timeline dorée, badges de statut, modales en verre                                                                               |
| **Back-office admin** (dashboard, chambres, users)          | Tableaux lisibles, stats en verre, boutons dorés/destructifs, **recherche + filtres + export CSV**                                 |
| **Factures**                                                | Papier blanc imprimable conservé, posé sur le site sombre, boutons dorés                                                               |

### Navbar

- Logo à gauche, **liens centrés**, Réserver + cloche notifs + thème + déconnexion à droite.
- **Fusion transparente** au repos (clair et sombre), verre givré au scroll, **hamburger mobile uniquement**.

### Détails & correctifs UI

- Boutons magnétiques adoucis (attraction 16 %).
- Liens « photos » des chambres réparés (`generateStaticParams` pré-génère les vrais slugs).
- Sélecteur d'indicatif : dropdown verre + vrais drapeaux (images), largeur figée, colonnes alignées, positionnement corrigé (`!absolute` — les classes verre forçaient `position: relative`).
- **Zoom du logo** au clic (bords verre circulaires).
- **Favicon** (logo) via `app/icon.jpg` + `apple-icon.jpg`.
- Optimisations mobiles (titre hero, wordmark navbar).

---

## 2. Sécurité & robustesse (backend Laravel)

- **Rate-limiting** sur `/login` et `/register` (`throttle:6,1`) — anti brute-force (`routes/api.php`).
- **IDOR corrigé** : `PaymentController::checkStatus` scopé au propriétaire (ou admin), sinon 403.
- **Expiration de token** : colonne `api_token_expires_at` (30 j), posée à la connexion/inscription et vérifiée dans `ApiTokenMiddleware` (migration `2026_07_19_000001`).
- **Admin plafonné à 20 réservations** → levé (page de 200, jusqu'à 500) : les filtres portent sur l'ensemble.
- **Anti double-booking** : `AdminReservationController::approve` fait verrou chambre + vérif dispo + mise à jour dans **une seule transaction** ; + **index DB** `(room_id, status, check_in, check_out)` (migration `2026_07_19_000002`).
- **Interceptor 401 global** (front, `lib/api.ts`) : session expirée → déconnexion propre + redirection partout.

---

## 3. Fonctionnel & UX (Vague 1 + fonctionnalités)

- **Fuseau horaire** : `config/app.php` → `Africa/Porto-Novo` + dates calculées en **local** côté front (écart de caution près de minuit corrigé).
- ~~**Règle de caution** : basée sur les **nuits × tarif**~~ — ⚠️ **AFFIRMATION FAUSSE**, corrigée le 2026-08-18 après vérification du code. La caution est **toujours** calculée sur le délai avant l'arrivée (`daysUntilCheckIn × deposit_per_day`), en back (`ReservationController::store`) comme en front (`RoomClient.tsx`). Une réservation test de 2 nuits à 170 000 F a produit une caution de **4 600 000 F**. Chantier à traiter.
- **Garde-fous** : durée ≤ 90 nuits + **nombre de voyageurs** réellement contrôlé (≤ capacité) avec sélecteur dans le formulaire.
- **Plus de déconnexion forcée** après une demande → on reste connecté, redirection espace client.
- **Accessibilité** : toasts `aria-live` / `role` (`ToastContext`).
- **Bouton WhatsApp** (pastille ronde, en bas à droite) affiché **uniquement sur la fiche appartement** — numéro à renseigner.
- **Galerie photo en lightbox** (`ImageLightbox`) : plein écran, navigation flèches/clavier.
- **Section Avis / Témoignages** sur la home (cartes verre, étoiles dorées).
- **Admin** : recherche (nom/email/tél/réf), filtre par plage de dates, **export CSV**, correction de `occupancy_rate` (chambres réservables uniquement), **CA du mois**.
- **Cloche de notifications** in-app : `NotificationController` + routes + `NotificationBell` (compteur non-lues, dropdown verre, « tout marquer lu »).

---

## 4. Qualité & outillage

- **Prettier** configuré (`.prettierrc.json`, `.prettierignore`, `.editorconfig`) + scripts `npm run format` / `format:check` ; tout le code source formaté de façon homogène (guillemets doubles, 2 espaces).
- Vérifs systématiques : **`npx tsc --noEmit` = 0 erreur**, **`npm run build` = 22 pages, export statique OK**, **ESLint = 0 warning**, **`php -l` = 0 erreur** sur les fichiers backend.

---

## 5. Notes de déploiement

1. **`php artisan migrate`** sur le serveur (colonnes token + index réservations). ⚠️ Sans ça, le code d'expiration référence une colonne absente → connexion cassée.
2. Remplacer le **numéro WhatsApp** dans `components/ui/WhatsAppButton.tsx`.
3. `npm run build` → uploader le dossier **`out/`** (contient le `.htaccess` de routing SPA). ⚠️ **`npm run build` efface `out/.htaccess`** : le restaurer après chaque build (`git checkout HEAD -- manoir-frontend/out/.htaccess`).
4. Le front tape sur `NEXT_PUBLIC_API_URL` (prod `https://api.lemanoir.bj/api`).

_Détails techniques/gotchas : voir aussi la mémoire projet et [PISTES-AMELIORATION.md](PISTES-AMELIORATION.md)._

---

## 6. Securite & architecture (2026-08-18 / 19)

### Authentification — migration vers Sanctum

- Token maison mono-session remplace par **Laravel Sanctum 4.3** : `HasApiTokens`, `createToken()` avec expiration 30 j, `auth:sanctum` sur les routes.
- `ApiTokenMiddleware` supprime, colonnes `api_token` / `api_token_expires_at` droppees (migration `2026_08_18_110000`).
- **Multi-appareils** : se connecter sur un second appareil ne deconnecte plus le premier. Les tokens sont nommes d'apres l'appareil (Windows / Android / iOS...).
- `logout` ne revoque que le token courant.
- **Le frontend n'a necessite aucune modification** (token opaque en `Bearer`, interceptor 401 deja en place).

### Mot de passe oublie

- `POST /api/forgot-password` + `POST /api/reset-password`, pages `/auth/mot-de-passe-oublie` et `/auth/nouveau-mot-de-passe`.
- Reponse **identique** que l'adresse existe ou non (pas d'enumeration de comptes).
- Reinitialiser son mot de passe **revoque tous les tokens** de l'utilisateur.

### Verification d'adresse email

- Lien signe `GET /api/email/verify/{id}/{hash}` (60 min), `POST /api/email/resend`, `GET /api/email/status`.
- Page `/auth/email-confirme` + banniere de renvoi dans l'espace client (`EmailVerificationBanner`).
- **Rien n'est bloque** tant que l'email n'est pas confirme : c'est un rappel, pas un verrou. Le gating des actions sensibles reste une decision produit.

### Rate-limiting — bug corrige

Un `throttle:6,1` anonyme est keye sur **(domaine, IP) et ignore l'URL** : toutes les routes limitees partageaient donc **un seul compteur** de 6 requetes/minute. Se connecter epuisait le quota du mot de passe oublie.
→ Limiteurs nommes dans `AppServiceProvider::configureRateLimiting` (`login`, `register`, `password-reset`, `email-verify`, `email-resend`). Le limiteur de connexion est keye sur IP **et** email : une attaque sur un compte ne bloque plus les autres clients derriere la meme IP.

### Emails — Brevo

SMTP Brevo configure et **teste avec de vrais envois**. Deux pieges documentes dans DEPLOIEMENT.md : le blocage d'IP (actif par defaut, `525 Unauthorized IP address`) et l'expediteur non valide.
⚠️ L'expediteur actuel est une adresse Gmail : sans DKIM ni DMARC possibles, les mails finiront de plus en plus en spam. A remplacer par une adresse sur le domaine du site avant l'ouverture au public.

### Tests

De **7 a 21 tests** (57 assertions) : `PasswordResetTest` (7) et `EmailVerificationTest` (7) ajoutes.

### Correctifs annexes

- `.env.example` **cree** — il n'existait pas, la commande `copy .env.example .env` d'INSTALL.md echouait.
- INSTALL.md : retrait de `db:seed --class=RoomSeeder`, qui plante (`UNIQUE constraint failed: rooms.slug`) car les migrations creent deja les 8 appartements.
- `suppressHydrationWarning` sur `<body>` (`app/layout.tsx`) : les extensions de navigateur injectent leurs attributs avant l'hydratation React et declenchaient une erreur console a tort.
