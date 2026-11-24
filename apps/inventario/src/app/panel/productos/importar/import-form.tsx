"use client";

import { useActionState } from "react";
import { Button, Field, Input, Textarea } from "@stackline/core/ui";
import { importProductsAction, type ImportState } from "../../actions";

const EXAMPLE = `sku;nombre;categoria;precio;costo;stock;stock_minimo
VEL-010;Vela de soya canela 200 g;Velas y aromas;9990;3800;12;6
TEX-010;Cojín bordado a mano;Textiles;21990;9500;6;3`;

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importProductsAction, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Archivo CSV">
        <Input type="file" name="file" accept=".csv,text/csv" className="h-auto py-2" />
      </Field>
      <Field label="…o pega el contenido">
        <Textarea name="csv" rows={6} defaultValue={EXAMPLE} className="font-mono text-xs" />
      </Field>
      {state.message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Importando…" : "Importar"}</Button>
    </form>
  );
}
