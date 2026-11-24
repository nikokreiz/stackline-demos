"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@stackline/core/ui";
import { acceptInvitationAction, type AcceptState } from "./actions";

export function AcceptForm({ token, hasAccount }: { token: string; hasAccount: boolean }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitationAction.bind(null, token), {});
  return (
    <form action={action} className="mt-6 space-y-4">
      {!hasAccount && (
        <Field label="Tu nombre" htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
      )}
      <Field label={hasAccount ? "Tu contraseña de Reservo" : "Crea una contraseña"} htmlFor="password" hint={hasAccount ? undefined : "Mínimo 8 caracteres."}>
        <Input id="password" name="password" type="password" required autoComplete={hasAccount ? "current-password" : "new-password"} />
      </Field>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? "Entrando…" : "Aceptar invitación"}</Button>
    </form>
  );
}
