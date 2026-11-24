import { Boxes, Calculator, FileSpreadsheet, History, Store, TrendingUp } from "lucide-react";
import { ButtonLink, Card, DemoBanner } from "@stackline/core/ui";

const features = [
  { icon: Store, title: "Todos tus canales en un lugar", text: "Tienda física, Instagram, Mercado Libre y tu web descuentan del mismo stock." },
  { icon: Calculator, title: "Ganancia real, no solo ventas", text: "Restamos costo de la mercadería, comisiones de cada canal, envíos y gastos fijos." },
  { icon: TrendingUp, title: "Costo promedio automático", text: "Cada compra recalcula el costo ponderado. Sabes cuánto ganas por producto aunque el proveedor suba precios." },
  { icon: Boxes, title: "Stock por bodega y alertas", text: "Bodega y tienda separadas, traslados y aviso cuando un producto baja de su mínimo." },
  { icon: History, title: "Historial auditable", text: "Cada entrada, venta o ajuste queda registrado con quién lo hizo y cuándo." },
  { icon: FileSpreadsheet, title: "Desde y hacia Excel", text: "Importa tu planilla de productos y exporta ventas e inventario cuando lo necesites." },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-canvas">
      <DemoBanner>Demo de Stackline con datos ficticios · Software a medida para pymes en Chile</DemoBanner>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-lg font-semibold">
          Margen<span className="text-brand">.</span>
        </span>
        <ButtonLink href="/login" variant="secondary" size="sm">
          Entrar al panel
        </ButtonLink>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-brand">Para pymes que venden en local, Instagram y Mercado Libre</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Vendiste harto este mes. ¿Pero cuánto ganaste de verdad?
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            Margen ordena tu inventario de todos los canales y te muestra la ganancia real después de comisiones, envíos
            y gastos. Deja atrás la planilla que nadie actualiza.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="lg">
              Probar la demo
            </ButtonLink>
            <ButtonLink href="https://stacklines.vercel.app/#contacto" size="lg" variant="secondary">
              Cotizar con Stackline
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="size-6 text-brand" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{f.text}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-10 p-8">
          <h2 className="text-xl font-semibold">Lo adaptamos a tu operación</h2>
          <p className="mt-1 text-ink-soft">
            Tus canales, tus bodegas y tus reglas. Podemos conectarlo con Mercado Libre y tu facturación electrónica.
            Código 100% tuyo, construido por Stackline en Chile.
          </p>
        </Card>
      </section>
    </div>
  );
}
