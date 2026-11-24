import Link from "next/link";
import { Button, Card } from "@stackline/core/ui";
import { demoLoginAction } from "./actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-xl font-semibold">
          Reservo<span className="text-brand">.</span>
        </Link>
        <Card className="p-6">
          <h1 className="text-lg font-semibold">Probar la demo</h1>
          <p className="mt-1 text-sm text-ink-soft">Entra con un clic a la agenda de una barbería ficticia.</p>
          <div className="mt-4 grid gap-2">
            <form action={demoLoginAction}>
              <input type="hidden" name="as" value="owner" />
              <Button className="w-full">Entrar como dueño</Button>
            </form>
            <form action={demoLoginAction}>
              <input type="hidden" name="as" value="staff" />
              <Button variant="secondary" className="w-full">
                Entrar como recepción
              </Button>
            </form>
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" /> o con tu cuenta <span className="h-px flex-1 bg-line" />
          </div>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
