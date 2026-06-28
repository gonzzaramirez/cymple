"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { MemberProfessional } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { DataCard } from "@/components/data-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getProfessionalColumns } from "./professional-columns";

type Props = {
  professionals: MemberProfessional[];
  initialQuery?: string;
  initialStatus?: string;
};

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">Activo</Badge>
  ) : (
    <Badge variant="secondary">Inactivo</Badge>
  );
}

export function ProfessionalsList({
  professionals,
  initialQuery = "",
  initialStatus = "all",
}: Props) {
  const isMobile = useIsMobile();

  if (professionals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-12 text-center shadow-card">
        <p className="text-lg font-medium">No hay profesionales registrados</p>
        <p className="text-sm text-muted-foreground">
          Usá el botón &quot;Nuevo profesional&quot; para agregar el primero.
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {professionals.map((pro) => (
          <DataCard
            key={pro.id}
            eyebrow={pro.specialty ?? "Profesional"}
            title={pro.fullName}
            description={pro.email}
            meta={() => <ActiveBadge isActive={pro.isActive} />}
            items={[
              { label: "Teléfono", value: pro.phone ?? "—" },
              { label: "Turnos", value: `${pro.totalAppointments}` },
              { label: "Pacientes", value: `${pro.totalPatients}` },
              {
                label: "Consulta",
                value: `${pro.consultationMinutes} min`,
              },
            ]}
          />
        ))}
      </div>
    );
  }

  const columns = getProfessionalColumns();

  return (
    <div className="space-y-4">
      <form method="get" className="flex gap-3">
        <Input
          name="query"
          defaultValue={initialQuery}
          placeholder="Buscar por nombre..."
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={initialStatus}
          className="flex h-9 w-36 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <Button type="submit">Buscar</Button>
      </form>

      <DataTable
        columns={columns}
        data={professionals}
        enableSorting
        emptyMessage="Sin profesionales"
        enablePagination={false}
      />
    </div>
  );
}
