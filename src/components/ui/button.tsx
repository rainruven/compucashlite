import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
        primary: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        secondary: "bg-white text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-50",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
        outlineDestructive: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
        ghost: "text-slate-700 hover:bg-slate-200/70",
        amber: "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
      },
      size: {
        default: "min-h-12 px-5 py-2",
        sm: "min-h-10 px-3 text-sm",
        lg: "min-h-14 px-6 text-lg",
        icon: "size-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
