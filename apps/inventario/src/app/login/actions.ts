"use server";

import { redirect } from "next/navigation";
import { checkCredentials, endSession, startSession } from "@stackline/core/auth";
import { getDb } from "@/db";
import { DEMO_USERS } from "@/db/seed";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const db = await getDb();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const ok = await checkCredentials(db, email, password);
  if (!ok) return { error: "Correo o contraseña incorrectos." };
  await startSession(db, ok.userId, ok.orgId);
  redirect("/panel");
}

/** Entrada con un clic para quien prueba la demo desde un anuncio. */
export async function demoLoginAction(form: FormData) {
  const who = form.get("as") === "staff" ? DEMO_USERS.staff : DEMO_USERS.owner;
  const db = await getDb();
  const ok = await checkCredentials(db, who.email, who.password);
  if (!ok) throw new Error("No se encontró el usuario de demostración.");
  await startSession(db, ok.userId, ok.orgId);
  redirect("/panel");
}

export async function logoutAction() {
  await endSession(await getDb());
  redirect("/login");
}
