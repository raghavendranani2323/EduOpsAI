import * as React from "react";
import { cn } from "@/lib/utils";

const baseField = [
  "flex w-full rounded-[0.875rem]",
  "bg-[var(--surface-1)] border border-border",
  "px-3.5 text-sm text-foreground",
  "placeholder:text-muted-foreground/70",
  "shadow-xs",
  "transition-[box-shadow,border-color,background-color] duration-150",
  "hover:border-[color-mix(in_oklch,var(--border)_60%,var(--primary))]",
  "focus-visible:outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:shadow-[0_0_0_3px_var(--ring)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseField, "h-11", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseField, "min-h-[88px] py-2.5", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(baseField, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)} {...props} />
  ),
);
Label.displayName = "Label";
