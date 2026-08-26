import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl2 border border-neutral-300 bg-white px-3.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 dark:border-neutral-700 dark:bg-graphite-soft",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl2 border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 dark:border-neutral-700 dark:bg-graphite-soft",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
