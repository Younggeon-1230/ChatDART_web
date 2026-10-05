import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/classNames";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-950 text-white shadow-sm shadow-blue-950/10 hover:bg-blue-800 focus-visible:ring-blue-300 disabled:bg-slate-300",
  secondary:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-300 disabled:bg-slate-100 disabled:text-slate-400",
  outline:
    "border border-sky-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-sky-50 focus-visible:ring-blue-200 disabled:border-slate-200 disabled:text-slate-400",
  ghost:
    "bg-transparent text-slate-600 hover:bg-sky-50 hover:text-blue-950 focus-visible:ring-blue-200 disabled:text-slate-300",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-200 disabled:border-red-100 disabled:bg-red-50 disabled:text-red-300",
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-sm",
  icon: "h-9 w-9 p-0",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70",
        variantClassName[variant],
        sizeClassName[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
