import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-300',
        'hover:translate-y-[-2px] hover:shadow-xl active:translate-y-0',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
        {
          'bg-gradient-to-r from-primary to-primary-strong text-white hover:shadow-primary/50': variant === 'primary',
          'bg-white text-primary border-2 border-primary hover:bg-primary-soft hover:border-primary-strong': variant === 'secondary',
          'bg-transparent text-primary hover:bg-primary/10': variant === 'ghost',
          'bg-transparent text-primary border-2 border-primary hover:bg-primary-soft hover:border-primary-strong': variant === 'outline',
        },
        {
          'h-10 px-4 text-sm rounded-lg': size === 'sm',
          'h-12 px-6 text-base': size === 'default',
          'h-14 px-8 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}