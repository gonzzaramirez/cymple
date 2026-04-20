import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DataCardItem = {
  label: string;
  value: string;
};

type DataCardProps = {
  title: string;
  items: DataCardItem[];
  footer?: ReactNode;
};

export function DataCard({ title, items, footer }: DataCardProps) {
  return (
    <Card className="shadow-card transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.map((item) => (
          <div
            key={`${title}-${item.label}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-sm font-medium text-foreground">{item.value}</span>
          </div>
        ))}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
