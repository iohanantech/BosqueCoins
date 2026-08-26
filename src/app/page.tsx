import { redirect } from "next/navigation";

/**
 * A raiz "/" nao faz parte do matcher do middleware (que protege /dashboard,
 * /admin etc.) - por isso so redireciona pra dentro da area protegida, nunca
 * renderiza conteudo proprio aqui.
 */
export default function RootPage() {
  redirect("/dashboard");
}
