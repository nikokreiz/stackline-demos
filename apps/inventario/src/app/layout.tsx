import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Margen · Inventario y ganancia real", template: "%s · Margen" },
  description:
    "Inventario multicanal con costo promedio, comisiones por canal y ganancia real del mes, para pymes que venden en local, Instagram y Mercado Libre. Demo de Stackline.",
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
