import { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export default function SectionLabel({
  children,
  className = "",
}: SectionLabelProps) {
  return (
    <div className={`mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900 ${className}`}>
      <span className="h-2 w-2 rounded-full bg-sky-400" />
      {children}
    </div>
  );
}
