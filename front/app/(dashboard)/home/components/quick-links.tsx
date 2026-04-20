import Link from "next/link";
import { Users, Calendar, DollarSign, Clock, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  {
    href: "/patients",
    label: "Pacientes",
    description: "Gestionar historial y fichas",
    icon: Users,
    accent: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    href: "/appointments",
    label: "Agenda",
    description: "Ver y crear turnos",
    icon: Calendar,
    accent: "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400",
  },
  {
    href: "/finance",
    label: "Finanzas",
    description: "Ingresos y egresos",
    icon: DollarSign,
    accent: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
  },
  {
    href: "/availability",
    label: "Disponibilidad",
    description: "Configurar horarios",
    icon: Clock,
    accent: "text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400",
  },
];

export function QuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <Link key={s.href} href={s.href} className="group">
            <Card className="shadow-card hover:shadow-card-hover h-full transition-shadow duration-200">
              <CardContent className="flex flex-col gap-3 p-4">
                <div
                  className={`flex size-9 items-center justify-center rounded-xl ${s.accent}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {s.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
