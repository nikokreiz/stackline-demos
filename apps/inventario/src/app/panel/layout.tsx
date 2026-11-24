import { ArrowLeftRight, ChartPie, Package, Receipt, ShoppingBag, Store, Truck } from "lucide-react";
import { AppShell, type NavItem } from "@stackline/core/ui/shell";
import { panel } from "@/lib/panel";
import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Dueña", admin: "Administrador", staff: "Vendedor" } as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { session } = await panel();
  const nav: NavItem[] = [
    { href: "/panel", label: "Resumen", icon: <ChartPie />, exact: true },
    { href: "/panel/ventas", label: "Ventas", icon: <ShoppingBag /> },
    { href: "/panel/productos", label: "Productos y stock", icon: <Package /> },
    { href: "/panel/compras", label: "Compras", icon: <Truck /> },
    { href: "/panel/gastos", label: "Gastos", icon: <Receipt /> },
    { href: "/panel/canales", label: "Canales", icon: <Store /> },
    { href: "/panel/movimientos", label: "Movimientos", icon: <ArrowLeftRight /> },
  ];
  const visible = session.role === "staff" ? nav.filter((n) => !["/panel", "/panel/gastos", "/panel/canales"].includes(n.href)) : nav;
  return (
    <AppShell
      product={
        <>
          Margen<span className="text-brand">.</span>
        </>
      }
      orgName={session.org.name}
      userName={session.user.name}
      role={ROLE_LABEL[session.role]}
      nav={visible}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
