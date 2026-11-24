import { CalendarDays, ChartColumn, House, MessageSquareText, Scissors, UserRound, Users } from "lucide-react";
import { AppShell, type NavItem } from "@stackline/core/ui/shell";
import { panel } from "@/lib/panel";
import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Dueño", admin: "Administrador", staff: "Recepción" } as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { session } = await panel();
  const nav: NavItem[] = [
    { href: "/panel", label: "Hoy", icon: <House />, exact: true },
    { href: "/panel/agenda", label: "Agenda", icon: <CalendarDays /> },
    { href: "/panel/clientes", label: "Clientes", icon: <Users /> },
    { href: "/panel/servicios", label: "Servicios", icon: <Scissors /> },
    { href: "/panel/equipo", label: "Equipo y horarios", icon: <UserRound /> },
    { href: "/panel/mensajes", label: "Mensajes", icon: <MessageSquareText /> },
  ];
  if (session.role !== "staff") nav.splice(5, 0, { href: "/panel/reportes", label: "Reportes", icon: <ChartColumn /> });

  return (
    <AppShell
      product={
        <>
          Reservo<span className="text-brand">.</span>
        </>
      }
      orgName={session.org.name}
      userName={session.user.name}
      role={ROLE_LABEL[session.role]}
      nav={nav}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
