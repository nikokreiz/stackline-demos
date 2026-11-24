"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@stackline/core/ui";
import { saveSettingsAction, type SettingsState } from "../actions";

type Org = {
  name: string;
  slug: string;
  industry: string | null;
  settings: { description?: string; address?: string; phone?: string; whatsapp?: string; instagram?: string; brandColor?: string; cancellationHours?: number };
};

export function SettingsForm({ org, baseUrl, industries, editable }: { org: Org; baseUrl: string; industries: Array<[string, string]>; editable: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  const [slug, setSlug] = useState(org.slug);
  const s = org.settings;
  return (
    <form action={action} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
      <fieldset disabled={!editable} className="contents">
        <Field label="Nombre del negocio" htmlFor="name">
          <Input id="name" name="name" defaultValue={org.name} required />
        </Field>
        <Field label="Rubro" htmlFor="industry">
          <Select id="industry" name="industry" defaultValue={org.industry ?? "otro"}>
            {industries.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Enlace de reservas" htmlFor="slug" hint={`${baseUrl}/reservar/${slug || "…"}`}>
            <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Descripción corta" htmlFor="description" hint="Aparece en tu página de reservas.">
            <Textarea id="description" name="description" rows={2} defaultValue={s.description} maxLength={200} />
          </Field>
        </div>
        <Field label="Dirección" htmlFor="address"><Input id="address" name="address" defaultValue={s.address} /></Field>
        <Field label="Teléfono" htmlFor="phone"><Input id="phone" name="phone" defaultValue={s.phone} /></Field>
        <Field label="WhatsApp del local" htmlFor="whatsapp" hint="Para el botón “Escribir al local”."><Input id="whatsapp" name="whatsapp" defaultValue={s.whatsapp} placeholder="+56912345678" /></Field>
        <Field label="Instagram" htmlFor="instagram"><Input id="instagram" name="instagram" defaultValue={s.instagram} placeholder="@tunegocio" /></Field>
        <Field label="Color de tu marca" htmlFor="brandColor">
          <Input id="brandColor" name="brandColor" type="color" defaultValue={s.brandColor ?? "#0f766e"} className="h-10 p-1" />
        </Field>
        <Field label="Horas mínimas para cancelar o cambiar" htmlFor="cancellationHours" hint="Antes de eso, el cliente puede hacerlo solo desde su enlace.">
          <Input id="cancellationHours" name="cancellationHours" type="number" min={0} max={72} defaultValue={s.cancellationHours ?? 4} />
        </Field>
        {editable && (
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
            {state.ok && <span className="text-sm text-emerald-600">Guardado.</span>}
            {state.error && <span className="text-sm text-red-600">{state.error}</span>}
          </div>
        )}
      </fieldset>
    </form>
  );
}
