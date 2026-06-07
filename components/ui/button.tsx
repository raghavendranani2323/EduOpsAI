import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
        secondary:   "bg-muted text-foreground hover:bg-muted/70",
        outline:     "border border-border bg-background hover:bg-muted",
        ghost:       "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        success:     "bg-success text-white hover:opacity-90",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm:   "h-9 px-3 text-xs [&_svg]:size-3.5",
        md:   "h-11 px-4 [&_svg]:size-4",
        lg:   "h-12 px-5 text-base [&_svg]:size-5",
        icon: "h-11 w-11 [&_svg]:size-4",
        iconSm: "h-9 w-9 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
