import Link from "next/link";
import { getSession } from "@stackline/core/auth";
import { Card } from "@stackline/core/ui";
import { getDb } from "@/db";
import { TRIAL_DAYS } from "@/lib/onboarding";
import { INDUSTRIES } from "@/lib/templates";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crea tu agenda" };

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const session = (await searchParams).nuevo ? await getSession(await getDb()) : null;
  const industries = Object.entries(INDUSTRIES).map(([k, v]) => [k, v.label] as [string, string]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-xl font-semibold">
          Reservo<span className="text-brand">.</span>
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{session ? "Agregar otro negocio" : "Crea tu agenda online"}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {session
              ? `Lo crearás con tu cuenta ${session.user.email}.`
              : `${TRIAL_DAYS} días gratis, sin tarjeta. En 2 minutos tienes tu enlace de reservas.`}
          </p>
          <div className="mt-6">
            <SignupForm industries={industries} loggedInAs={session?.user.email} />
          </div>
        </Card>
        {!session && (
          <p className="mt-4 text-center text-sm text-ink-soft">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-brand">
              Entra aquí
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
