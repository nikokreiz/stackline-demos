import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { hashToken } from "@stackline/core/auth";
import { Card } from "@stackline/core/ui";
import { getDb } from "@/db";
import { invitations, organizations, users } from "@/db/schema";
import { AcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitación", robots: { index: false } };

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ inv: invitations, orgName: organizations.name })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.orgId))
    .where(and(eq(invitations.tokenHash, hashToken(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        {!row ? (
          <>
            <h1 className="text-lg font-semibold">Invitación no válida</h1>
            <p className="mt-2 text-sm text-ink-soft">El enlace expiró o ya se usó. Pide una nueva invitación al dueño del negocio.</p>
            <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand">Ir al login</Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Únete a {row.orgName}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Te invitaron como {row.inv.role === "admin" ? "administrador" : "recepción"} con el correo {row.inv.email}.
            </p>
            <AcceptForm
              token={token}
              hasAccount={!!(await db.select({ id: users.id }).from(users).where(eq(users.email, row.inv.email)))[0]}
            />
          </>
        )}
      </Card>
    </div>
  );
}
