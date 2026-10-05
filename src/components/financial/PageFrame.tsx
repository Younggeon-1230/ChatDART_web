import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { SectionCard } from "@/components/common/Card";

type PageFrameProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  hideHeader?: boolean;
};

export default function PageFrame({
  title,
  description,
  icon: Icon,
  children,
  hideHeader = false,
}: PageFrameProps) {
  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-0 sm:space-y-6">
      {!hideHeader && (
        <SectionCard className="overflow-hidden border-blue-100 bg-gradient-to-br from-white via-sky-50 to-blue-50 px-5 py-5 shadow-md shadow-blue-100/50 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sky-100 p-3 text-blue-700 ring-1 ring-sky-200">
              <Icon className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-blue-950 md:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {children}
    </div>
  );
}
