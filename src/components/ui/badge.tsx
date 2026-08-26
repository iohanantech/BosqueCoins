import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "gold" | "success" | "warning" | "danger" }) {
  const variants: Record<string, string> = {
    default: "bg-neutral-100 text-neutral-700 dark:bg-graphite-soft dark:text-neutral-200",
    gold: "bg-gold/15 text-gold-dark dark:text-gold-light",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variants[variant], className)}
      {...props}
    />
  );
}
