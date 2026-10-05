import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/classNames";

type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
};

export function TextInput({ className, invalid, ...props }: TextInputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
        invalid ? "border-red-300 focus:border-red-400 focus-visible:ring-red-100" : "border-sky-200",
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function FormField({
  label,
  htmlFor,
  helperText,
  errorText,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  helperText?: ReactNode;
  errorText?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-semibold text-slate-900"
        >
          {label}
        </label>
      )}
      {children}
      {helperText && !errorText && (
        <p className="text-xs leading-5 text-slate-500">{helperText}</p>
      )}
      {errorText && (
        <p className="text-xs leading-5 text-red-600">{errorText}</p>
      )}
    </div>
  );
}
