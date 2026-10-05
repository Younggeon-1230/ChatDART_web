import { ReactNode } from "react";
import { SectionCard } from "@/components/common/Card";

type BoxProps = {
  children: ReactNode;
  className?: string;
};

export default function Box({ children, className = "" }: BoxProps) {
  return <SectionCard className={className}>{children}</SectionCard>;
}
