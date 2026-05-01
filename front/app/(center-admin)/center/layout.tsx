import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CenterSidebar } from "@/components/center-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { serverApiFetch } from "@/lib/server-api";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type MeResponse = {
  name: string;
  role: string;
};

export default async function CenterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const me = await serverApiFetch<MeResponse>("auth/me").catch(() => null);
  if (!me) {
    redirect("/login");
  }
  if (me.role !== "CENTER_ADMIN") {
    redirect("/home");
  }

  return (
    <SidebarProvider>
      <CenterSidebar centerName={me.name} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-[var(--border-light)] bg-[var(--col-bg13)]/95 px-5 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--col-bg13)]/80">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5!" />
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-5 md:p-6"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
