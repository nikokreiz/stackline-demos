import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Reservo · Agenda online para tu negocio", template: "%s · Reservo" },
  description:
    "Agenda online con abono y recordatorios por WhatsApp para barberías, centros de estética y profesionales de la salud. Demo de Stackline.",
};

export const viewport: Viewport = { themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
