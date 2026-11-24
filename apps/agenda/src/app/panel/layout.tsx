import Link from "next/link";
import { CalendarDays, ChartColumn, House, MessageSquareText, Scissors, Settings, Shield, UserRound, Users } from "lucide-react";
import { isSuperAdmin } from "@stackline/core/auth";
import { AppShell, type NavItem } from "@stackline/core/ui/shell";
import { getOrg, trialDaysLeft } from "@/lib/org";
import { panel } from "@/lib/panel";
import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Dueño", admin: "Administrador", staff: "Recepción" } as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { db, session } = await panel();
  const org = await getOrg(db, session.org.id);
  const days = trialDaysLeft(org);
  const nav: NavItem[] = [
    { href: "/panel", label: "Hoy", icon: <House />, exact: true },
    { href: "/panel/agenda", label: "Agenda", icon: <CalendarDays /> },
    { href: "/panel/clientes", label: "Clientes", icon: <Users /> },
    { href: "/panel/servicios", label: "Servicios", icon: <Scissors /> },
    { href: "/panel/equipo", label: "Equipo y horarios", icon: <UserRound /> },
    { href: "/panel/mensajes", label: "Mensajes", icon: <MessageSquareText /> },
    { href: "/panel/ajustes", label: "Ajustes", icon: <Settings /> },
  ];
  if (session.role !== "staff") nav.splice(5, 0, { href: "/panel/reportes", label: "Reportes", icon: <ChartColumn /> });
  if (isSuperAdmin(session.user.email)) nav.push({ href: "/admin", label: "Stackline admin", icon: <Shield /> });

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
      {days !== null && (
        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ${
            days > 3 ? "bg-brand-soft text-brand-strong" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          <span>
            {days > 0
              ? `Estás en la prueba gratis: te quedan ${days} ${days === 1 ? "día" : "días"}.`
              : "Tu prueba gratis terminó. Tus clientes aún pueden reservar; elige un plan para seguir usando el panel."}
          </span>
          <Link href="/panel/ajustes#plan" className="font-medium underline">
            Ver planes
          </Link>
        </div>
      )}
      {children}
    </AppShell>
  );
}
