import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/classNames";

type SectionCardProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  padded?: boolean;
};

type HeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function SectionCard({
  children,
  className,
  padded = false,
  ...props
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-sky-200 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur",
        padded && "p-5 sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function InnerSurface({
  children,
  className,
  ...props
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-sky-100 bg-sky-50/60 p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeaderBlock({
  eyebrow,
  title,
  description,
  action,
  className,
}: HeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-sm font-medium text-slate-500">
            {eyebrow}
          </div>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function AuthCard({ children, className, ...props }: SectionCardProps) {
  return (
    <SectionCard
      className={cn("mx-auto w-full max-w-md p-5 sm:p-6", className)}
      {...props}
    >
      {children}
    </SectionCard>
  );
}

export function PricingCard({
  children,
  className,
  ...props
}: SectionCardProps) {
  return (
    <SectionCard
      className={cn("flex h-full flex-col p-5 sm:p-6", className)}
      {...props}
    >
      {children}
    </SectionCard>
  );
}

export function TableFrame({
  children,
  className,
  tableClassName,
  caption,
  ariaLabel,
  ...props
}: SectionCardProps & {
  tableClassName?: string;
  caption?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-lg overscroll-x-contain",
        className
      )}
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      tabIndex={ariaLabel ? 0 : undefined}
      {...props}
    >
      <table
        aria-label={ariaLabel}
        className={cn(
          "min-w-[720px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-slate-200 text-sm",
          tableClassName
        )}
      >
        {caption && (
          <caption className="sr-only">
            {caption}
          </caption>
        )}
        {children}
      </table>
    </div>
  );
}
