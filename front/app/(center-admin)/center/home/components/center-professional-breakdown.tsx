import { DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProfessionalStats = {
  id: string;
  fullName: string;
  specialty: string | null;
  appointmentsThisMonth: number;
  patientsTotal?: number;
  revenueThisMonth?: number;
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function CenterProfessionalBreakdown({
  professionals,
}: {
  professionals: ProfessionalStats[];
}) {
  if (professionals.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Users className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Todavia no hay profesionales activos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Desglose por profesional
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:hidden">
          {professionals.map((professional) => (
            <div key={professional.id} className="rounded-2xl border border-[var(--border-light)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{professional.fullName}</p>
                  {professional.specialty && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{professional.specialty}</p>
                  )}
                </div>
                <Badge variant="secondary">{professional.appointmentsThisMonth} turnos</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric icon={<Users className="size-4" />} label="Pacientes" value={professional.patientsTotal ?? "-"} />
                <Metric icon={<DollarSign className="size-4" />} label="Ingresos" value={currency.format(professional.revenueThisMonth ?? 0)} />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-[var(--border-light)] md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-[0.05em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Profesional</th>
                <th className="px-4 py-3 text-right font-semibold">Turnos mes</th>
                <th className="px-4 py-3 text-right font-semibold">Pacientes</th>
                <th className="px-4 py-3 text-right font-semibold">Ingresos mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {professionals.map((professional) => (
                <tr key={professional.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{professional.fullName}</p>
                    {professional.specialty && (
                      <p className="text-xs text-muted-foreground">{professional.specialty}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{professional.appointmentsThisMonth}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{professional.patientsTotal ?? "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{currency.format(professional.revenueThisMonth ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
