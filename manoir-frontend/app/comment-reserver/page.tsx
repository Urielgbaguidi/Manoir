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
    title: "Dates et appartement",
    text: "Le client consulte les categories, les photos, les videos et le prix par nuit, choisit l'appartement precis qui l'interesse puis ses dates d'arrivee et de depart. La disponibilite s'affiche aussitot.",
    icon: CalendarCheck
  },
  {
    title: "Vos informations",
    text: "Le client se connecte ou cree son compte (email confirme et telephone obligatoires), indique le nombre de voyageurs et ses demandes speciales, puis verifie le recapitulatif.",
    icon: UserPlus
  },
  {
    title: "Demande envoyee",
    text: "La demande est gratuite : rien n'est paye a cette etape. Elle passe en attente de validation par l'equipe du Manoir, et le client est prevenu par email des qu'elle est traitee.",
    icon: FileText
  },
  {
    title: "Paiement du sejour",
    text: "Une fois la demande validee, le paiement s'ouvre dans l'espace client, avec une heure limite. Le client regle le sejour complet en ligne, par Mobile Money (MTN, Moov, Celtiis) ou par carte bancaire, via FeexPay.",
    icon: CreditCard
  },
  {
    title: "Confirme et Bon de Sejour",
    text: "Des que le paiement est confirme par FeexPay, la reservation est confirmee et le Bon de Sejour est disponible au telechargement. Il est a presenter a l'arrivee.",
    icon: CheckCircle2
  }
];

const keyRules = [
  {
    title: "Validation avant paiement",
    text: "Aucun paiement n'est demande a l'envoi de la demande. Le paiement ne s'ouvre qu'apres validation par l'equipe du Manoir.",
    icon: ShieldCheck
  },
  {
    title: "Delai de paiement",
    text: "Apres validation, le sejour doit etre regle avant l'heure limite affichee. Passe ce delai, ou si la date d'arrivee est depassee, la demande expire et l'appartement est remis a la location.",
    icon: Clock3
  },
  {
    title: "Annulation",
    text: "Une demande pas encore payee peut etre annulee sans frais jusqu'au jour de l'arrivee inclus. Pour un sejour deja paye, contactez l'equipe du Manoir.",
    icon: XCircle
  },
  {
    title: "Prolongation du sejour",
    text: "Pendant un sejour paye, apres au moins une journee sur place et avant la date de depart, le client peut demander une prolongation. Elle est validee par l'equipe, puis reglee en ligne : un nouveau Bon de Sejour est alors emis.",
    icon: CalendarCheck
  }
];

const statusRows = [
  [
    "EN_ATTENTE",
    "La demande est envoyee et attend la validation de l'equipe du Manoir. Rien n'est a payer."
  ],
  [
    "VALIDEE_PAIEMENT_REQUIS",
    "La demande est validee. Le paiement du sejour est ouvert dans l'espace client et doit etre fait avant l'heure limite affichee."
  ],
  ["SEJOUR_PAYE", "Le sejour est paye et confirme. Le Bon de Sejour est disponible."],
  ["CONFIRMEE", "Ancien parcours : reservation confirmee par le versement d'un acompte."],
  ["REFUSEE", "La demande a ete refusee par l'administration."],
  [
    "EXPIREE",
    "Le delai de paiement est depasse, ou la date d'arrivee est passee sans paiement. Le paiement est ferme et l'appartement est libere."
  ],
  ["ANNULEE", "Le client a annule sa demande avant le debut du sejour."],
  ["REMBOURSEE", "L'administration a confirme le remboursement."],
  [
    "LIBEREE",
    "L'occupation a ete terminee par l'administration. L'appartement est de nouveau disponible."
  ]
];

const documentRows = [
  ["Bon de Sejour", "Emis automatiquement des que le paiement du sejour est confirme."],
  [
    "Bon de Sejour de prolongation",
    "Emis pour chaque prolongation payee, avec la nouvelle date de depart."
  ],
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
              Cette page explique tout le parcours : choix de l'appartement et des dates, envoi de
              la demande, validation par l'equipe du Manoir, paiement en ligne du sejour, Bon de
              Sejour, annulation et prolongation.
            </p>
          </div>

          <div className="glass-dark glass-edge rounded-2xl p-7 text-cream">
            <div className="flex items-start gap-4">
              <Clock3 className="mt-1 h-6 w-6 flex-shrink-0 text-gold-light" />
              <div>
                <h2 className="font-display text-3xl font-semibold uppercase leading-none">
                  Payer apres <span className="text-gradient-gold">validation</span>
                </h2>
                <p className="mt-4 text-sm leading-7 text-cream/70">
                  Envoyer une demande est gratuit. Des qu'elle est validee, vous etes prevenu par
                  email et le paiement du sejour s'ouvre dans votre espace client, avec une heure
                  limite. Passe ce delai sans paiement, la demande expire et l'appartement repart a
                  la location.
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
                Le sejour se paie en une fois, apres validation de la demande : nombre de nuits
                multiplie par le prix par nuit. Mobile Money (MTN, Moov, Celtiis) ou carte bancaire,
                via la plateforme securisee FeexPay.
              </p>
              <p>
                Le paiement est toujours verifie aupres de FeexPay avant d'etre confirme. Le Bon de
                Sejour est ensuite disponible dans l'espace client.
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
                  Une demande en attente de validation ou de paiement peut etre annulee sans frais
                  jusqu'au jour de l'arrivee inclus : l'appartement se relibere aussitot. Pour un
                  sejour deja paye, contactez l'equipe du Manoir.
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
                  L'espace client suit chaque demande etape par etape : validation, paiement avec
                  compte a rebours, Bons de Sejour, historique, profil et demandes de prolongation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
