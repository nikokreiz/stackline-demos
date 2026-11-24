"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "./index";

export type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean };

/** Estructura del panel: barra lateral (menú en móvil) + contenido. */
export function AppShell({
  product,
  orgName,
  userName,
  role,
  nav,
  logout,
  children,
}: {
  product: ReactNode;
  orgName: string;
  userName: string;
  role: string;
  nav: NavItem[];
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <div className="text-lg font-semibold text-ink">{product}</div>
        <p className="mt-1 truncate text-sm text-ink-soft">{orgName}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(i) ? "bg-brand-soft text-brand-strong" : "text-ink-soft hover:bg-subtle hover:text-ink",
            )}
          >
            <span className="size-4 [&>svg]:size-4">{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-line p-4">
        <p className="truncate text-sm font-medium text-ink">{userName}</p>
        <p className="text-xs capitalize text-ink-soft">{role}</p>
        <form action={logout} className="mt-3">
          <button className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink cursor-pointer">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="font-semibold text-ink">{product}</div>
        <button aria-label="Abrir menú" onClick={() => setOpen(true)} className="p-1 text-ink cursor-pointer">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
            <button
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 p-1 text-ink cursor-pointer"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
