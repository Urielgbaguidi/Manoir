import { Quote, Star } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

type Testimonial = {
  name: string;
  initials: string;
  location: string;
  rating: number;
  quote: string;
};

const testimonials: Testimonial[] = [
  {
    name: "Thomas Régnier",
    initials: "TR",
    location: "Paris, France",
    rating: 5,
    quote:
      "Entre deux rendez-vous, Le Manoir a été mon refuge. Un appartement impeccable, une kitchenette qui change tout et un silence rare en plein Cotonou. Je n'y logerai plus autrement."
  },
  {
    name: "Fatima & Ismaël B.",
    initials: "FI",
    location: "Cotonou, Bénin",
    rating: 5,
    quote:
      "Nous cherchions une parenthèse à deux, nous avons trouvé bien plus. La lumière chaude, le bois, l'intimité des lieux… Deux nuits qui ont eu le goût d'un véritable voyage."
  },
  {
    name: "Chimène Ahouansou",
    initials: "CA",
    location: "Cotonou, Bénin",
    rating: 5,
    quote:
      "À quelques minutes de chez moi et pourtant à mille lieues du tumulte. L'accueil est d'une élégance discrète et tout est pensé dans le détail. Mon adresse pour souffler."
  },
  {
    name: "Kwame Mensah",
    initials: "KM",
    location: "Accra, Ghana",
    rating: 4,
    quote:
      "Je séjourne au Manoir à chacun de mes passages à Cotonou. Autonomie totale, cadre sécurisé et un confort constant — la sérénité d'un lieu sur lequel on peut compter."
  }
];

export default function Testimonials() {
  return (
    <section id="temoignages" className="relative px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Ils ont séjourné</p>
            <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-semibold uppercase leading-[0.9] tracking-[-0.04em]">
              Paroles <span className="text-gradient-gold">d&apos;hôtes</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-cream/60">
            Voyages d&apos;affaires, escapades à deux ou échappées au cœur de Cotonou — quelques
            mots de celles et ceux qui ont poussé notre porte.
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 0.08}>
              <figure className="glass-warm glass-edge group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-7 md:p-8">
                <span className="sheen" />
                <Quote
                  aria-hidden
                  className="pointer-events-none absolute -right-3 -top-3 size-20 rotate-6 fill-current text-gold/[0.08]"
                />

                <div className="relative">
                  <div
                    className="flex items-center gap-1"
                    aria-label={`Note ${testimonial.rating} sur 5`}
                  >
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        size={15}
                        className={
                          starIndex < testimonial.rating
                            ? "fill-current text-gold-light"
                            : "text-cream/20"
                        }
                      />
                    ))}
                  </div>

                  <blockquote className="mt-5 text-[15px] leading-7 text-cream/80">
                    «&nbsp;{testimonial.quote}&nbsp;»
                  </blockquote>
                </div>

                <figcaption className="relative mt-7 flex items-center gap-4 border-t border-gold/15 pt-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold/25 bg-white/5 font-display text-sm font-semibold tracking-wide text-gold-light">
                    {testimonial.initials}
                  </span>
                  <div>
                    <p className="font-display text-base font-semibold uppercase tracking-[0.02em] text-cream">
                      {testimonial.name}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-cream/55">
                      {testimonial.location}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
