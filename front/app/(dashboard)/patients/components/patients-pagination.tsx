"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

function buildHref(page: number, query: string, limit: number) {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("limit", String(limit));
  if (query.trim()) p.set("query", query.trim());
  return `/patients?${p.toString()}`;
}

type PatientsPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  query: string;
  limit: number;
  className?: string;
};

export function PatientsPagination({
  page,
  totalPages,
  total,
  query,
  limit,
  className,
}: PatientsPaginationProps) {
  if (totalPages <= 1) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {total === 0
          ? "Sin resultados"
          : `Mostrando ${total} paciente${total !== 1 ? "s" : ""}`}
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
        Página {page} de {totalPages} — {total} paciente{total !== 1 ? "s" : ""} en
        total
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {page > 1 ? (
              <Link
                href={buildHref(page - 1, query, limit)}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                )}
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
                href={buildHref(num, query, limit)}
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
                href={buildHref(page + 1, query, limit)}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                )}
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
