"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Patient, ApiList } from "@/lib/types";
import { PatientsList } from "./patients-list";

type PatientsDirectoryProps = {
  data: ApiList<Patient>;
  query: string;
  limit: number;
};

export function PatientsDirectory({ data, query, limit }: PatientsDirectoryProps) {
  return (
    <div className="space-y-4">
      <form method="get" action="/patients" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="limit" value={String(limit)} />
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            key={query}
            name="query"
            type="search"
            placeholder="Buscar por nombre, apellido, DNI, teléfono o email…"
            defaultValue={query}
            className="h-10 pl-9 pr-3 shadow-none md:h-9"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="submit" className="w-full sm:w-auto">
            Buscar
          </Button>
        </div>
      </form>

      <PatientsList
        patients={data.items}
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        limit={data.limit}
        query={query}
      />
    </div>
  );
}
