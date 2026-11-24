"use client";

import { useActionState } from "react";
import { Button, Field, Input, Select } from "@stackline/core/ui";
import { signupAction, type SignupState } from "./actions";

export function SignupForm({ industries, loggedInAs }: { industries: Array<[string, string]>; loggedInAs?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      {loggedInAs && <input type="hidden" name="mode" value="nuevo" />}
      <Field label="Nombre del negocio" htmlFor="business">
        <Input id="business" name="business" required defaultValue={v.business} placeholder="Ej: Barbería Los Aromos" />
      </Field>
      <Field label="Rubro" htmlFor="industry" hint="Te dejamos servicios de ejemplo que puedes cambiar.">
        <Select id="industry" name="industry" defaultValue={v.industry || "barberia"}>
          {industries.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {!loggedInAs && (
        <>
          <Field label="Tu nombre" htmlFor="name">
            <Input id="name" name="name" required autoComplete="name" defaultValue={v.name} />
          </Field>
          <Field label="Correo" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email} />
          </Field>
          <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres.">
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="terms" className="mt-1" required />
            Acepto los términos del servicio y el tratamiento de mis datos para operar la agenda.
          </label>
        </>
      )}
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creando tu agenda…" : loggedInAs ? "Crear negocio" : "Crear mi agenda gratis"}
      </Button>
    </form>
  );
}
