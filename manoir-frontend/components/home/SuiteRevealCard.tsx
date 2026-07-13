"use client";

import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useEffect, useRef } from "react";

export type Suite = {
  image: string;
  alt: string;
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
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 78%",
            once: true
          }
        }
      );

      gsap.fromTo(
        imageRef.current,
        { scale: 1.16 },
        {
          scale: 1,
          duration: 1.45,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 78%",
            once: true
          }
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <motion.article
      ref={rootRef}
      initial={{ opacity: 0, y: 70 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ delay: index * 0.08, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <div className="relative aspect-[4/5] overflow-hidden border border-bark/12 bg-bark">
        <div ref={imageRef} className="absolute inset-0 will-change-transform">
          <Image
            src={suite.image}
            alt={suite.alt}
            fill
            sizes="(max-width: 768px) 100vw, 34vw"
            className="object-cover grayscale contrast-125 transition duration-[1200ms] ease-out group-hover:scale-110 group-hover:grayscale-0"
          />
        </div>
        <div ref={maskRef} className="absolute inset-0 z-10 bg-bark will-change-transform" />
      </div>
    </motion.article>
  );
}
