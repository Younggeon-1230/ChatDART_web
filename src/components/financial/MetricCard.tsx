import { SectionCard } from "@/components/common/Card";
import { cn } from "@/lib/classNames";

type Props = {
  title: string;
  value: string;
  desc: string;
  valueClassName?: string;
};

export default function MetricCard({
  title,
  value,
  desc,
  valueClassName,
}: Props) {
  return (
    <SectionCard className="border-blue-100 bg-gradient-to-br from-white to-sky-50 p-5">
      <div className="text-sm font-medium text-blue-700">{title}</div>
      <div
        className={cn(
          "mt-2 text-2xl font-bold",
          valueClassName ?? "text-blue-950"
        )}
      >
        {value}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
    </SectionCard>
  );
}
