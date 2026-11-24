import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@stackline/core/ui";
import { ImportForm } from "./import-form";

export const metadata = { title: "Importar productos" };

export default function ImportarPage() {
  return (
    <>
      <Link href="/panel/productos" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Productos
      </Link>
      <PageHeader title="Importar planilla de productos" description="Exporta tu Excel como CSV (separado por comas o punto y coma) y súbelo aquí." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <ImportForm />
        </Card>
        <Card className="h-fit p-5 text-sm">
          <p className="font-medium">Columnas</p>
          <ul className="mt-2 space-y-1 text-ink-soft">
            <li><code>sku</code> y <code>nombre</code>: obligatorias</li>
            <li><code>categoria</code>, <code>precio</code>, <code>stock_minimo</code></li>
            <li><code>costo</code> y <code>stock</code>: solo para productos nuevos</li>
          </ul>
          <p className="mt-3 text-ink-soft">Si el SKU ya existe, se actualizan nombre, categoría, precio y mínimo.</p>
        </Card>
      </div>
    </>
  );
}
