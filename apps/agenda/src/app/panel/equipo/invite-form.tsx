"use client";

import { useActionState } from "react";
import { Button, Field, Input, Select } from "@stackline/core/ui";
import { CopyLink } from "@/components/copy-link";
import { inviteAction, type InviteState } from "../actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAction, {});
  return (
    <form action={action} className="space-y-3 border-t border-line px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field label="Correo de la persona"><Input name="email" type="email" required /></Field>
        <Field label="Rol">
          <Select name="role">
            <option value="staff">Recepción</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
        <Button variant="secondary" disabled={pending}>{pending ? "Creando…" : "Invitar"}</Button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.link && (
        <div className="rounded-lg bg-subtle p-3 text-sm">
          <p>Envíale este enlace (vence en 7 días):</p>
          <CopyLink url={state.link} />
          <a
            className="mt-2 inline-block text-sm font-medium text-brand"
            href={`https://wa.me/?text=${encodeURIComponent(`Te invito a nuestra agenda en Reservo: ${state.link}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Compartir por WhatsApp
          </a>
        </div>
      )}
    </form>
  );
}
