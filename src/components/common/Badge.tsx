import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/classNames";

type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "premium";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: BadgeTone;
  children: ReactNode;
};

const toneClassName: Record<BadgeTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-sky-100 bg-sky-50 text-sky-700",
  success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  premium: "border-indigo-100 bg-indigo-50 text-indigo-700",
};

export function StatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
        toneClassName[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function TrendBadge({
  direction,
  children,
}: {
  direction: "up" | "down" | "flat" | "missing";
  children: ReactNode;
}) {
  const tone =
    direction === "up"
      ? "success"
      : direction === "down"
        ? "warning"
        : direction === "missing"
          ? "neutral"
          : "info";

  return <StatusBadge tone={tone}>{children}</StatusBadge>;
}

export function PlanBadge({
  plan,
  children,
}: {
  plan: "free" | "pro" | "premium" | "pending";
  children: ReactNode;
}) {
  const tone = plan === "free" ? "neutral" : plan === "pending" ? "warning" : "premium";
  return <StatusBadge tone={tone}>{children}</StatusBadge>;
}

export function CompanyChip({
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <StatusBadge
      tone="neutral"
      className={cn("min-w-0 px-3 py-2 text-sm", className)}
      {...props}
    >
      {children}
    </StatusBadge>
  );
}
