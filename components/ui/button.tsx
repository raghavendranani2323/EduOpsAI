import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "text-sm font-semibold tracking-tight",
    "transition-[transform,box-shadow,background-color,color] duration-150 ease-out",
    "focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-sm hover:shadow-md",
          "hover:bg-[color-mix(in_oklch,var(--primary)_92%,black)]",
        ].join(" "),
        secondary: [
          "bg-[var(--surface-2)] text-foreground border border-border",
          "hover:bg-muted",
        ].join(" "),
        outline: [
          "border border-border bg-card",
          "shadow-xs hover:bg-[var(--surface-1)] hover:border-[color-mix(in_oklch,var(--border)_70%,var(--primary))]",
        ].join(" "),
        ghost: "text-foreground hover:bg-muted",
        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-sm hover:shadow-md",
          "hover:bg-[color-mix(in_oklch,var(--destructive)_92%,black)]",
        ].join(" "),
        success: [
          "bg-[var(--success)] text-white",
          "shadow-sm hover:shadow-md",
          "hover:bg-[color-mix(in_oklch,var(--success)_92%,black)]",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        sm:     "h-9 px-3 text-xs [&_svg]:size-3.5",
        md:     "h-11 px-4 [&_svg]:size-4",
        lg:     "h-12 px-5 text-base [&_svg]:size-[18px]",
        xl:     "h-14 px-6 text-base [&_svg]:size-5",
        icon:   "h-11 w-11 [&_svg]:size-4",
        iconSm: "h-9 w-9 [&_svg]:size-3.5",
        iconLg: "h-12 w-12 [&_svg]:size-5",
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
