"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { MemberProfessional } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { DataCard } from "@/components/data-card";
import { Badge } from "@/components/ui/badge";
import { getProfessionalColumns } from "./professional-columns";

type Props = {
  professionals: MemberProfessional[];
};

export function ProfessionalsList({ professionals }: Props) {
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
            meta={
              pro.isActive ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )
            }
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
    <DataTable
      columns={columns}
      data={professionals}
      enableSorting
      emptyMessage="Sin profesionales"
      enablePagination={false}
    />
  );
}
