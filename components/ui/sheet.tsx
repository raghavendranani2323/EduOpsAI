"use client";

import * as React from "react";
import { Drawer as Vaul } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Vaul.Root;
export const SheetTrigger = Vaul.Trigger;
export const SheetClose = Vaul.Close;
export const SheetPortal = Vaul.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof Vaul.Overlay>,
  React.ComponentPropsWithoutRef<typeof Vaul.Overlay>
>(({ className, ...props }, ref) => (
  <Vaul.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/50 backdrop-blur-xs", className)} {...props} />
));
SheetOverlay.displayName = "SheetOverlay";

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof Vaul.Content>,
  React.ComponentPropsWithoutRef<typeof Vaul.Content> & { side?: "bottom" | "right" }
>(({ className, children, side = "bottom", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <Vaul.Content
      ref={ref}
      className={cn(
        "fixed z-50 bg-card text-card-foreground shadow-xl flex flex-col outline-none",
        side === "bottom" && "inset-x-0 bottom-0 rounded-t-2xl max-h-[92dvh] pb-[env(safe-area-inset-bottom)]",
        side === "right" && "inset-y-0 right-0 w-[88%] max-w-md",
        className,
      )}
      {...props}
    >
      {side === "bottom" && (
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
      )}
      {children}
    </Vaul.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-2 p-4 pb-2", className)} {...props}>
      <div className="flex-1 min-w-0">{children}</div>
      <SheetClose className="p-1 rounded-lg hover:bg-muted shrink-0" aria-label="Close">
        <X className="h-4 w-4" />
      </SheetClose>
    </div>
  );
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Vaul.Title className={cn("font-semibold text-base leading-tight", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <Vaul.Description className={cn("text-xs text-muted-foreground mt-0.5", className)} {...props} />;
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-4 pt-2", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2 p-4 border-t bg-card", className)} {...props} />;
}
