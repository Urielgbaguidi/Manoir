"use client";

import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

export type Suite = {
  image: string;
  alt: string;
  label?: string;
};

type SuiteRevealCardProps = {
  suite: Suite;
  index: number;
};

export default function SuiteRevealCard({ suite, index }: SuiteRevealCardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        maskRef.current,
        { xPercent: 0 },
        {
          xPercent: 102,
          duration: 1.15,
          ease: "power4.inOut",
          scrollTrigger: { trigger: rootRef.current, start: "top 80%", once: true }
        }
      );

      gsap.fromTo(
        imageRef.current,
        { scale: 1.18 },
        {
          scale: 1,
          duration: 1.5,
          ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 80%", once: true }
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <motion.article
      ref={rootRef}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ delay: index * 0.08, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="on-dark group relative"
    >
      <Link href="/rooms" className="block">
        <div className="glass-warm glass-edge relative overflow-hidden rounded-[1.6rem] p-2 shadow-glass transition-transform duration-500 group-hover:-translate-y-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.2rem] bg-night">
            <div ref={imageRef} className="absolute inset-0 will-change-transform">
              <Image
                src={suite.image}
                alt={suite.alt}
                fill
                sizes="(max-width: 768px) 100vw, 34vw"
                className="object-cover brightness-[0.92] contrast-105 transition-all duration-[1200ms] ease-out group-hover:scale-105 group-hover:brightness-100"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />
            <span className="sheen" />

            {/* Légende */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold-light">
                  0{index + 1}
                </span>
                <p className="mt-1 font-display text-xl font-semibold uppercase leading-none tracking-tight text-cream">
                  {suite.label ?? "Suite"}
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-full border border-gold/40 bg-white/10 text-cream backdrop-blur-md transition group-hover:bg-gold group-hover:text-night">
                <ArrowUpRight size={16} />
              </span>
            </div>

            {/* Masque de révélation GSAP */}
            <div ref={maskRef} className="absolute inset-0 z-10 bg-night will-change-transform" />
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
