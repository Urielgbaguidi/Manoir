import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold uppercase tracking-[0.18em] transition-all duration-300",
        "hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:ring-offset-2 focus:ring-offset-night",
        {
          "bg-gradient-to-br from-gold-light to-gold text-night shadow-[0_10px_36px_-10px_rgba(201,164,92,0.7)] hover:brightness-105":
            variant === "primary",
          "glass-warm glass-edge text-cream hover:border-gold/50": variant === "secondary",
          "bg-transparent text-cream hover:bg-white/10": variant === "ghost",
          "border border-gold/40 text-cream hover:border-gold hover:bg-gold/10":
            variant === "outline"
        },
        {
          "h-10 px-5 text-[11px]": size === "sm",
          "h-12 px-7 text-xs": size === "default",
          "h-14 px-9 text-sm": size === "lg"
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
