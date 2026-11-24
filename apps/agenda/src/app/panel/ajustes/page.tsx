import { Check, Plus } from "lucide-react";
import { listUserOrgs } from "@stackline/core/auth";
import { fmtDate } from "@stackline/core/format";
import { Badge, Button, ButtonLink, Card, CardHeader, PageHeader } from "@stackline/core/ui";
import { CopyLink } from "@/components/copy-link";
import { getBaseUrl } from "@/lib/base-url";
import { PLAN_LABEL, getOrg, trialDaysLeft } from "@/lib/org";
import { canManage, panel } from "@/lib/panel";
import { INDUSTRIES } from "@/lib/templates";
import { switchOrgAction } from "../actions";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Ajustes" };

const PLANS = [
  { key: "basico", name: "Básico", price: "$14.990 / mes", features: ["1 a 3 profesionales", "Reservas y recordatorios ilimitados", "Abonos con Mercado Pago"] },
  { key: "pro", name: "Pro", price: "$29.990 / mes", features: ["Profesionales ilimitados", "Reportes avanzados", "Soporte prioritario por WhatsApp"] },
];

export default async function AjustesPage() {
  const { db, orgId, session } = await panel();
  const [org, orgs, baseUrl] = await Promise.all([getOrg(db, orgId), listUserOrgs(db, session.user.id), getBaseUrl()]);
  const days = trialDaysLeft(org);
  const industries = Object.entries(INDUSTRIES).map(([k, v]) => [k, v.label] as [string, string]);

  return (
    <>
      <PageHeader title="Ajustes" description="Datos de tu negocio, tu página de reservas y tu plan." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Tu negocio" subtitle={canManage(session.role) ? undefined : "Solo el dueño o un administrador puede cambiar estos datos."} />
            <SettingsForm org={org} baseUrl={baseUrl} industries={industries} editable={canManage(session.role)} />
          </Card>
          <Card>
            <CardHeader title="Tu enlace de reservas" />
            <div className="px-5 pb-5">
              <CopyLink url={`${baseUrl}/reservar/${org.slug}`} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div id="plan" />
            <CardHeader title="Plan" action={<Badge tone={org.plan === "trial" ? "amber" : "brand"}>{PLAN_LABEL[org.plan] ?? org.plan}</Badge>} />
            <div className="space-y-3 px-5 py-4 text-sm">
              {days !== null && (
                <p className="text-ink-soft">
                  {days > 0 ? `Tu prueba gratis termina el ${fmtDate(org.trialEndsAt!)}.` : "Tu prueba gratis terminó."}
                </p>
              )}
              {org.plan === "demo" && <p className="text-ink-soft">Negocio de demostración: los datos se reinician cada día.</p>}
              {PLANS.map((p) => (
                <div key={p.key} className={`rounded-lg border p-3 ${org.plan === p.key ? "border-brand" : "border-line"}`}>
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-ink-soft">{p.price}</p>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-1.5"><Check className="size-3.5 text-brand" /> {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-ink-faint">Precios referenciales de la demo. El cobro de la suscripción aún no está conectado.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tus negocios" subtitle="Cambia entre los locales donde tienes acceso." />
            <ul className="divide-y divide-line">
              {orgs.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{o.name}</span>
                    <span className="text-xs text-ink-soft">/{o.slug}</span>
                  </span>
                  {o.id === orgId ? (
                    <Badge tone="brand">Actual</Badge>
                  ) : (
                    <form action={switchOrgAction.bind(null, o.id)}>
                      <Button variant="secondary" size="sm">Cambiar</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3">
              <ButtonLink href="/registro?nuevo=1" variant="ghost" size="sm">
                <Plus className="size-4" /> Agregar otro negocio
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
