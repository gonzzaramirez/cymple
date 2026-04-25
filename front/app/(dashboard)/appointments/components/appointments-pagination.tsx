"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type AppointmentsPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  className?: string;
};

export function AppointmentsPagination({
  page,
  totalPages,
  total,
  limit,
  className,
}: AppointmentsPaginationProps) {
  const sp = useSearchParams();

  function hrefFor(targetPage: number) {
    const p = new URLSearchParams(sp.toString());
    p.set("ui", "list");
    p.set("page", String(targetPage));
    p.set("limit", String(limit));
    return `/appointments?${p.toString()}`;
  }

  if (totalPages <= 1) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {total === 0
          ? "Sin resultados"
          : `Mostrando ${total} turno${total !== 1 ? "s" : ""}`}
      </p>
    );
  }

  const window = 5;
  const pageNums: number[] = [];
  if (totalPages <= window) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else if (page <= 3) {
    for (let i = 1; i <= window; i++) pageNums.push(i);
  } else if (page >= totalPages - 2) {
    for (let i = totalPages - 4; i <= totalPages; i++) pageNums.push(i);
  } else {
    for (let i = page - 2; i <= page + 2; i++) pageNums.push(i);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        Página {page} de {totalPages} — {total} turno{total !== 1 ? "s" : ""} en
        total
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {page > 1 ? (
              <Link
                href={hrefFor(page - 1)}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "pointer-events-none opacity-40",
                )}
                aria-hidden
              >
                <ChevronLeft className="size-4" />
              </span>
            )}
          </PaginationItem>
          {pageNums.map((num) => (
            <PaginationItem key={num}>
              <Link
                href={hrefFor(num)}
                className={cn(
                  buttonVariants({
                    variant: num === page ? "outline" : "ghost",
                    size: "default",
                  }),
                  "min-w-8 px-2",
                )}
                aria-current={num === page ? "page" : undefined}
              >
                {num}
              </Link>
            </PaginationItem>
          ))}
          <PaginationItem>
            {page < totalPages ? (
              <Link
                href={hrefFor(page + 1)}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "pointer-events-none opacity-40",
                )}
                aria-hidden
              >
                <ChevronRight className="size-4" />
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
