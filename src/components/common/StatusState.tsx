import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/classNames";

export type CommonStateVariant =
  | "loading"
  | "empty"
  | "error"
  | "info"
  | "success"
  | "warning";

type StatusStateProps = {
  variant: CommonStateVariant;
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

type InlineStatusMessageProps = {
  variant?: Exclude<CommonStateVariant, "success">;
  children: ReactNode;
  className?: string;
};

const stateClassName: Record<CommonStateVariant, string> = {
  loading:
    "border-sky-100 bg-gradient-to-br from-white to-sky-50 text-blue-950 shadow-sm shadow-sky-100/50",
  empty:
    "border-sky-100 bg-gradient-to-br from-sky-50 to-white text-slate-700",
  error:
    "border-rose-100 bg-gradient-to-br from-white to-rose-50 text-slate-800",
  info:
    "border-sky-100 bg-gradient-to-br from-white to-sky-50 text-blue-900",
  success:
    "border-emerald-100 bg-gradient-to-br from-white to-emerald-50 text-emerald-800",
  warning:
    "border-amber-100 bg-gradient-to-br from-white to-amber-50 text-amber-800",
};

const inlineClassName: Record<
  Exclude<CommonStateVariant, "success">,
  string
> = {
  loading: "text-blue-700",
  empty: "text-slate-500",
  error: "text-rose-700",
  info: "text-blue-700",
  warning: "text-amber-700",
};

const iconClassName: Record<CommonStateVariant, string> = {
  loading: "bg-sky-100 text-blue-700 ring-sky-200",
  empty: "bg-sky-100 text-sky-700 ring-sky-200",
  error: "bg-rose-50 text-rose-600 ring-rose-100",
  info: "bg-sky-100 text-blue-700 ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
};

function StatusIcon({ variant }: { variant: CommonStateVariant }) {
  const className = cn(
    "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
    iconClassName[variant]
  );

  if (variant === "loading") {
    return (
      <span className={className} aria-label="로딩 중">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  const iconMap: Record<Exclude<CommonStateVariant, "loading">, ReactNode> = {
    empty: <Search className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <span className={className} aria-hidden="true">
      {iconMap[variant]}
    </span>
  );
}

function LoadingSkeleton({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn("mt-4 grid gap-2", compact ? "max-w-xs" : "max-w-md")}
      aria-hidden="true"
    >
      <span className="h-2 animate-pulse rounded-full bg-sky-100" />
      <span className="h-2 w-4/5 animate-pulse rounded-full bg-sky-100" />
      {!compact && (
        <span className="h-2 w-2/3 animate-pulse rounded-full bg-sky-100" />
      )}
    </div>
  );
}

export function StatusState({
  variant,
  title,
  description,
  action,
  compact = false,
  className,
}: StatusStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        compact ? "p-3 text-sm" : "min-h-28 p-5 sm:p-6",
        stateClassName[variant],
        className
      )}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "loading" ? "polite" : undefined}
    >
      <div className="flex items-start gap-3">
        <StatusIcon variant={variant} />
        <div className="min-w-0 flex-1">
          {title && (
            <p
              className={cn(
                compact ? "font-medium" : "text-base font-semibold",
                variant === "error" ? "text-slate-900" : undefined
              )}
            >
              {title}
            </p>
          )}
          {description && (
            <p
              className={cn(
                title && "mt-1",
                "text-sm leading-relaxed text-slate-600"
              )}
            >
              {description}
            </p>
          )}
          {variant === "loading" && <LoadingSkeleton compact={compact} />}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function InlineStatusMessage({
  variant = "info",
  children,
  className,
}: InlineStatusMessageProps) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-xs leading-relaxed",
        inlineClassName[variant],
        className
      )}
    >
      {variant === "loading" && (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      )}
      {children}
    </p>
  );
}

export function PermissionRequiredState({
  description = "로그인 후 이용할 수 있는 기능입니다.",
}: {
  description?: string;
}) {
  return (
    <StatusState
      variant="info"
      title="로그인이 필요합니다"
      description={description}
    />
  );
}

export function MembershipRequiredState({
  description = "멤버십 플랜에서 제공될 예정인 기능입니다.",
}: {
  description?: string;
}) {
  return (
    <StatusState
      variant="warning"
      title="멤버십이 필요한 기능입니다"
      description={description}
    />
  );
}
