import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Protecao de PAGINAS por papel. A validacao real e sempre repetida no
 * backend (API routes, via requirePapel/requireSession) - este middleware
 * e so uma camada de UX para nao deixar a pessoa nem carregar a tela.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const papel = req.nextauth.token?.papel;

    const somenteAdmin = pathname.startsWith("/admin");
    if (somenteAdmin && papel !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const somentePecOuAdmin = pathname.startsWith("/pec");
    if (somentePecOuAdmin && papel !== "admin" && papel !== "professor") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const somenteProfessorPecAdmin = pathname.startsWith("/pontuar");
    if (somenteProfessorPecAdmin && papel === "aluno") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // /investir (INVESTIMENTOS.md) - so o aluno decide investir o proprio saldo (RN-15).
    const somenteAluno = pathname.startsWith("/investir");
    if (somenteAluno && papel !== "aluno") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/pontuar/:path*", "/extrato/:path*", "/premios/:path*", "/perfil/:path*", "/admin/:path*", "/pec/:path*", "/investir/:path*"],
};
