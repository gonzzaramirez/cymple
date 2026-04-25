import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DataCardItem = {
  label: string;
  value: string;
};

type DataCardProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  items?: DataCardItem[];
  footer?: ReactNode;
  className?: string;
};

export function DataCard({
  title,
  description,
  eyebrow,
  meta,
  items = [],
  footer,
  className,
}: DataCardProps) {
  return (
    <Card
      size="sm"
      className={className}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <CardTitle className="truncate text-base">
              {title}
            </CardTitle>
            {description ? (
              <div className="mt-1 text-sm text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          <div className="grid gap-2 rounded-xl bg-muted/35 p-3">
            {items.map((item) => (
              <div
                key={`${String(title)}-${item.label}`}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </span>
                <span className="truncate text-right text-sm font-medium text-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {footer ? <div>{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
