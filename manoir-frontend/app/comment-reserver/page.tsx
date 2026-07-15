import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";

const reservationSteps = [
  {
    title: "Choisir un appartement",
    text: "Le client consulte les categories, les photos, les videos, la description, le prix par nuit et la caution par jour. Pour les VIP, il choisit directement entre VIP 3 et VIP 7.",
    icon: CalendarCheck,
  },
  {
    title: "Creer son profil",
    text: "Au moment de reserver, le client cree son compte avec son nom, son email, son telephone et un mot de passe. S'il possede deja un compte, il peut se connecter.",
    icon: UserPlus,
  },
  {
    title: "Envoyer la demande",
    text: "Le client choisit la date d'arrivee, la date de depart et ajoute ses demandes speciales. La caution de reservation est calculee entre la date de demande et la date d'arrivee.",
    icon: FileText,
  },
  {
    title: "Validation admin",
    text: "L'administration examine la demande. Elle peut confirmer ou refuser avec un motif. Si elle confirme, le client recoit une autorisation de paiement de caution.",
    icon: ShieldCheck,
  },
  {
    title: "Payer la caution",
    text: "Le client dispose de 24h maximum pour payer la caution de reservation. Si le delai expire, ou si la date d'arrivee est atteinte sans paiement, la demande passe en expiree.",
    icon: CreditCard,
  },
  {
    title: "Commencer le sejour",
    text: "A la date d'arrivee, la reservation devient une occupation reelle. Le client ne peut plus annuler la reservation depuis son espace client.",
    icon: CheckCircle2,
  },
  {
    title: "Payer le sejour",
    text: "Le client peut payer ses frais de sejour depuis son espace client. Apres paiement, l'etape Sejour est cochee et la reservation passe directement dans l'historique.",
    icon: CreditCard,
  },
];

const keyRules = [
  {
    title: "Reservation et occupation",
    text: "La reservation correspond a la periode entre la date de demande et la date d'arrivee. L'occupation correspond a la periode entre la date d'arrivee et la date de depart.",
    icon: CalendarCheck,
  },
  {
    title: "Expiration automatique",
    text: "Une demande acceptee expire si la caution n'est pas payee dans les 24h, ou si la date d'arrivee est atteinte avant paiement. L'appartement est alors libere.",
    icon: Clock3,
  },
  {
    title: "Annulation avant arrivee",
    text: "Le client peut annuler uniquement avant la date d'arrivee. Quand l'occupation commence, le bouton d'annulation disparait.",
    icon: XCircle,
  },
  {
    title: "Prolongation du sejour",
    text: "Le client peut demander une prolongation seulement si le sejour a commence, qu'au moins une journee est passee et que le sejour n'est pas encore paye.",
    icon: ShieldCheck,
  },
];

const statusRows = [
  ["EN_ATTENTE", "La demande a ete envoyee et attend la validation de l'administration."],
  ["VALIDEE_PAIEMENT_REQUIS", "La demande est acceptee. La caution de reservation doit etre payee dans le delai affiche, avec une limite maximum de 24h."],
  ["CONFIRMEE", "La caution est payee. La reservation est definitivement confirmee."],
  ["SEJOUR_PAYE", "Les frais de sejour ont ete regles. La reservation passe dans l'historique."],
  ["REFUSEE", "La demande a ete refusee par l'administration."],
  ["EXPIREE", "Le delai de paiement est depasse, ou la date d'arrivee est atteinte sans paiement. Le paiement est bloque et l'appartement est libere."],
  ["ANNULEE", "Le client a annule sa reservation avant le debut de l'occupation."],
  ["REMBOURSEE", "L'administration a confirme le remboursement."],
  ["LIBEREE", "L'occupation a ete terminee par l'administration. L'appartement est de nouveau disponible."],
];

const documentRows = [
  ["Bon de Reservation", "Visible apres validation par l'administration, avant le paiement de la caution."],
  ["Facture Caution", "Visible apres paiement de la caution de reservation."],
  ["Bon du Sejour", "Visible quand la reservation est confirmee et que le sejour reste a regler."],
  ["Facture Sejour", "Visible apres paiement des frais de sejour."],
  ["Bon d'Annulation", "Visible si le client annule avant le debut de l'occupation."],
];

export default function HowToReservePage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-28 text-charcoal md:px-10 grain-layer">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-10 border-b border-bark/10 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2">
              <FileText className="h-4 w-4 text-bark" />
              <span className="text-[10px] font-black uppercase tracking-[0.32em] text-bark">
                Guide client
              </span>
            </div>
            <h1 className="font-display text-[clamp(3rem,8vw,7rem)] uppercase leading-[0.88] tracking-[-0.045em] text-bark">
              Comment reserver au Manoir
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-charcoal/85">
              Cette page explique tout le parcours : choix de l'appartement, creation du compte,
              validation par l'administration, caution de reservation, occupation reelle, documents,
              paiement du sejour, historique, annulation et prolongation.
            </p>
          </div>

          <div className="rounded-2xl border border-bark bg-bark p-7 text-cream shadow-2xl shadow-bark/20">
            <div className="flex items-start gap-4">
              <Clock3 className="mt-1 h-6 w-6 flex-shrink-0" />
              <div>
                <h2 className="font-display text-3xl uppercase leading-none">Delai de caution</h2>
                <p className="mt-4 text-sm leading-7 text-cream/90">
                  Apres acceptation par l'administration, le client dispose de 24h maximum pour payer
                  la caution de reservation. Si le delai expire, ou si la date d'arrivee est atteinte
                  sans paiement, le bouton de paiement est bloque et l'appartement est remis a disposition.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-bark/80">Processus</p>
              <h2 className="mt-3 font-display text-4xl uppercase text-bark md:text-5xl">Les etapes</h2>
            </div>
            <Link
              href="/rooms"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-bark px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-cream transition hover:bg-bark-light"
            >
              Voir les appartements <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reservationSteps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-bark/10 bg-cream-dark/40 p-6">
                <div className="mb-7 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-bark/80">
                    Etape {index + 1}
                  </span>
                  <span className="grid size-11 place-items-center rounded-full border border-bark/15 bg-cream text-bark">
                    <step.icon size={18} />
                  </span>
                </div>
                <h3 className="font-display text-3xl uppercase leading-none text-bark">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-charcoal/85">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-bark/10 py-12">
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-bark/80">Regles importantes</p>
            <h2 className="mt-3 font-display text-4xl uppercase text-bark md:text-5xl">A retenir</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {keyRules.map((rule) => (
              <article key={rule.title} className="rounded-2xl border border-bark/10 bg-white/45 p-6">
                <span className="mb-5 grid size-11 place-items-center rounded-full border border-bark/15 bg-cream text-bark">
                  <rule.icon size={18} />
                </span>
                <h3 className="font-display text-2xl uppercase leading-none text-bark">{rule.title}</h3>
                <p className="mt-4 text-sm leading-7 text-charcoal/85">{rule.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-bark/10 bg-cream-dark/40 p-7">
            <h2 className="font-display text-4xl uppercase leading-none text-bark">
              Paiements et documents
            </h2>
            <div className="mt-7 space-y-5 text-sm leading-7 text-charcoal/85">
              <p>
                La caution confirme la reservation. Elle est calculee selon le nombre de jours entre
                la date de demande et la date d'arrivee.
              </p>
              <p>
                Les frais de sejour correspondent au nombre de nuits multiplie par le prix par nuit.
                Apres paiement du sejour, la reservation quitte les demandes en cours et passe dans
                l'historique.
              </p>
            </div>
            <div className="mt-7 divide-y divide-bark/10 rounded-2xl border border-bark/10 bg-cream/70">
              {documentRows.map(([title, text]) => (
                <div key={title} className="p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-bark">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-charcoal/75">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-bark/10 bg-white/45 p-7">
            <h2 className="font-display text-4xl uppercase leading-none text-bark">Statuts de suivi</h2>
            <div className="mt-6 divide-y divide-bark/10">
              {statusRows.map(([status, description]) => (
                <div key={status} className="grid gap-2 py-4 md:grid-cols-[0.45fr_1fr]">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-bark">{status}</p>
                  <p className="text-sm leading-6 text-charcoal/85">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-10 md:grid-cols-2">
          <div className="rounded-2xl border border-terracotta/20 bg-terracotta/5 p-7">
            <div className="flex items-start gap-4">
              <XCircle className="mt-1 h-6 w-6 flex-shrink-0 text-terracotta" />
              <div>
                <h2 className="font-display text-3xl uppercase text-bark">Annulation</h2>
                <p className="mt-3 text-sm leading-7 text-charcoal/85">
                  Le client peut annuler si la demande est en attente, validee avant paiement ou deja
                  confirmee, mais seulement avant la date d'arrivee. Si la caution est deja payee,
                  le remboursement est calcule automatiquement selon les jours consommes.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-olive/20 bg-olive/5 p-7">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-6 w-6 flex-shrink-0 text-olive" />
              <div>
                <h2 className="font-display text-3xl uppercase text-bark">Espace client</h2>
                <p className="mt-3 text-sm leading-7 text-charcoal/85">
                  L'espace client centralise les demandes en cours, l'historique, les paiements,
                  les documents, le compte a rebours, la gestion du profil et les demandes de prolongation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
