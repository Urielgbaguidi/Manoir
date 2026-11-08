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
  XCircle
} from "lucide-react";

const reservationSteps = [
  {
    title: "Choisir un appartement",
    text: "Le client consulte les categories, les photos, les videos, la description et le prix par nuit. Il choisit ensuite l'appartement precis qui l'interesse, avec son etat de disponibilite.",
    icon: CalendarCheck
  },
  {
    title: "Creer son profil",
    text: "Au moment de reserver, le client cree son compte avec son nom, son email, son telephone et un mot de passe. S'il possede deja un compte, il peut se connecter.",
    icon: UserPlus
  },
  {
    title: "Reserver",
    text: "Le client choisit la date d'arrivee, la date de depart et ajoute ses demandes speciales. La reservation est enregistree aussitot : il n'y a aucune validation a attendre.",
    icon: FileText
  },
  {
    title: "Payer l'acompte sous 12h",
    text: "L'appartement est retenu 12 heures, le temps de regler l'acompte de 30 % du sejour. Passe ce delai sans paiement, la reservation expire et le logement repart a la location : un autre client peut alors le prendre.",
    icon: CreditCard
  },
  {
    title: "Commencer le sejour",
    text: "A la date d'arrivee, la reservation devient une occupation reelle. Le client ne peut plus annuler la reservation depuis son espace client.",
    icon: CheckCircle2
  },
  {
    title: "Payer le sejour",
    text: "Le client regle le solde du sejour depuis son espace client. L'acompte deja verse en est deduit : acompte + solde = prix du sejour. Apres paiement, la reservation passe dans l'historique.",
    icon: CreditCard
  }
];

const keyRules = [
  {
    title: "Premier paye, premier servi",
    text: "Reserver met l'appartement de cote, sans le garantir. Tant que l'acompte n'est pas regle, la reservation reste fragile : c'est le paiement qui la rend ferme.",
    icon: CalendarCheck
  },
  {
    title: "Expiration automatique",
    text: "Une reservation expire si l'acompte n'est pas paye dans les 12h, ou si la date d'arrivee est passee. L'appartement est alors libere sans intervention.",
    icon: Clock3
  },
  {
    title: "Annulation",
    text: "Le client peut annuler jusqu'au jour de l'arrivee inclus. L'appartement se relibere aussitot. Une fois la date d'arrivee passee, le bouton d'annulation disparait.",
    icon: XCircle
  },
  {
    title: "Prolongation du sejour",
    text: "Le client peut demander une prolongation seulement si le sejour a commence, qu'au moins une journee est passee et que le sejour n'est pas encore paye.",
    icon: ShieldCheck
  }
];

const statusRows = [
  [
    "VALIDEE_PAIEMENT_REQUIS",
    "La reservation est enregistree et l'appartement retenu. L'acompte doit etre paye avant l'heure limite affichee, au plus tard 12h apres la reservation."
  ],
  ["CONFIRMEE", "L'acompte est paye. La reservation est definitivement confirmee."],
  ["SEJOUR_PAYE", "Les frais de sejour ont ete regles. La reservation passe dans l'historique."],
  ["REFUSEE", "La demande a ete refusee par l'administration."],
  [
    "EXPIREE",
    "Le delai de paiement est depasse, ou la date d'arrivee est passee sans paiement. Le paiement est bloque et l'appartement est libere."
  ],
  ["ANNULEE", "Le client a annule sa reservation avant le debut de l'occupation."],
  ["REMBOURSEE", "L'administration a confirme le remboursement."],
  [
    "LIBEREE",
    "L'occupation a ete terminee par l'administration. L'appartement est de nouveau disponible."
  ]
];

const documentRows = [
  ["Bon de Reservation", "Visible des la reservation enregistree, avant le paiement de l'acompte."],
  ["Facture Acompte", "Visible apres paiement de l'acompte de reservation."],
  ["Bon du Sejour", "Visible quand la reservation est confirmee et que le sejour reste a regler."],
  ["Facture Sejour", "Visible apres paiement des frais de sejour."],
  ["Bon d'Annulation", "Visible si le client annule sa reservation."]
];

export default function HowToReservePage() {
  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-10 border-b border-gold/15 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md">
              <FileText className="h-4 w-4 text-gold-light" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cream/85">
                Guide client
              </span>
            </div>
            <h1 className="font-display text-[clamp(3rem,8vw,7rem)] font-semibold uppercase leading-[0.88] tracking-[-0.045em] text-cream">
              Comment <span className="text-gradient-gold">reserver</span> au Manoir
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-cream/70">
              Cette page explique tout le parcours : choix de l'appartement, creation du compte,
              validation par l'administration, acompte de reservation, occupation reelle, documents,
              paiement du sejour, historique, annulation et prolongation.
            </p>
          </div>

          <div className="glass-dark glass-edge rounded-2xl p-7 text-cream">
            <div className="flex items-start gap-4">
              <Clock3 className="mt-1 h-6 w-6 flex-shrink-0 text-gold-light" />
              <div>
                <h2 className="font-display text-3xl font-semibold uppercase leading-none">
                  Delai de <span className="text-gradient-gold">paiement</span>
                </h2>
                <p className="mt-4 text-sm leading-7 text-cream/70">
                  Reserver retient l'appartement pendant 12 heures, le temps de regler l'acompte de
                  30 % du sejour. Passe ce delai sans paiement, ou si la date d'arrivee est
                  depassee, la reservation expire : le paiement est bloque et l'appartement repart
                  a la location, ou un autre client peut le prendre.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Processus</p>
              <h2 className="mt-3 font-display text-4xl font-semibold uppercase text-cream md:text-5xl">
                Les <span className="text-gradient-gold">etapes</span>
              </h2>
            </div>
            <Link
              href="/rooms"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.22em] text-night transition hover:brightness-105"
            >
              Voir les appartements <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reservationSteps.map((step, index) => (
              <article
                key={step.title}
                className="glass-warm glass-edge glass-hover rounded-2xl p-6"
              >
                <div className="mb-7 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold/70">
                    Etape {index + 1}
                  </span>
                  <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-night">
                    <step.icon size={18} />
                  </span>
                </div>
                <h3 className="font-display text-3xl font-semibold uppercase leading-none text-cream">
                  {step.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-cream/70">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-gold/15 py-12">
          <div className="mb-8">
            <p className="eyebrow">Regles importantes</p>
            <h2 className="mt-3 font-display text-4xl font-semibold uppercase text-cream md:text-5xl">
              A <span className="text-gradient-gold">retenir</span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {keyRules.map((rule) => (
              <article
                key={rule.title}
                className="glass-warm glass-edge glass-hover rounded-2xl p-6"
              >
                <span className="mb-5 grid size-11 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-night">
                  <rule.icon size={18} />
                </span>
                <h3 className="font-display text-2xl font-semibold uppercase leading-none text-cream">
                  {rule.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-cream/70">{rule.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="glass-warm glass-edge rounded-2xl p-7">
            <h2 className="font-display text-4xl font-semibold uppercase leading-none text-cream">
              Paiements et <span className="text-gradient-gold">documents</span>
            </h2>
            <div className="mt-7 space-y-5 text-sm leading-7 text-cream/70">
              <p>
                L'acompte confirme la reservation. Elle est calculee selon le nombre de jours entre
                la date de demande et la date d'arrivee.
              </p>
              <p>
                Les frais de sejour correspondent au nombre de nuits multiplie par le prix par nuit.
                Apres paiement du sejour, la reservation quitte les demandes en cours et passe dans
                l'historique.
              </p>
            </div>
            <div className="mt-7 divide-y divide-gold/10 rounded-2xl border border-gold/15 bg-white/5">
              {documentRows.map(([title, text]) => (
                <div key={title} className="p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold/80">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-cream/60">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-warm glass-edge rounded-2xl p-7">
            <h2 className="font-display text-4xl font-semibold uppercase leading-none text-cream">
              Statuts de <span className="text-gradient-gold">suivi</span>
            </h2>
            <div className="mt-6 divide-y divide-gold/10">
              {statusRows.map(([status, description]) => (
                <div key={status} className="grid gap-2 py-4 md:grid-cols-[0.45fr_1fr]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold/80">
                    {status}
                  </p>
                  <p className="text-sm leading-6 text-cream/70">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-10 md:grid-cols-2">
          <div className="glass-edge rounded-2xl border border-terracotta/25 bg-terracotta/10 p-7">
            <div className="flex items-start gap-4">
              <XCircle className="mt-1 h-6 w-6 flex-shrink-0 text-terracotta-light" />
              <div>
                <h2 className="font-display text-3xl font-semibold uppercase text-cream">
                  Annulation
                </h2>
                <p className="mt-3 text-sm leading-7 text-cream/70">
                  Le client peut annuler tant que la date d'arrivee n'est pas passee, que
                  l'acompte soit deja regle ou non. L'appartement se relibere aussitot. Si un
                  acompte a ete verse, le montant rembourse lui est indique avant qu'il ne
                  confirme.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-edge rounded-2xl border border-olive/30 bg-olive/10 p-7">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-6 w-6 flex-shrink-0 text-olive-light" />
              <div>
                <h2 className="font-display text-3xl font-semibold uppercase text-cream">
                  Espace <span className="text-gradient-gold">client</span>
                </h2>
                <p className="mt-3 text-sm leading-7 text-cream/70">
                  L'espace client centralise les demandes en cours, l'historique, les paiements, les
                  documents, le compte a rebours, la gestion du profil et les demandes de
                  prolongation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
