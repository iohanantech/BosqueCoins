/**
 * RN-10 — restricao de dominio de e-mail, agora OPCIONAL.
 *
 * O porteiro real do acesso e o pre-cadastro: o e-mail precisa existir em
 * `usuarios` e estar ativo (isso vale sempre, ver auth/options.ts::signIn).
 *
 * `ALLOWED_EMAIL_DOMAIN` e uma camada extra, opcional:
 *  - definido (ex.: "bosquemananciais.org.br"): so aceita e-mails desse
 *    dominio, tanto no login quanto nos cadastros.
 *  - vazio / nao definido: qualquer dominio e aceito (Gmail, Outlook...),
 *    desde que o admin tenha cadastrado aquele e-mail.
 *
 * NAO ha mais fallback embutido no codigo - um ambiente sem a variavel
 * roda no modo "qualquer dominio", de proposito.
 */
/** Dominio configurado agora (lido a cada chamada - facilita teste). "" = sem restricao. */
function dominioConfigurado(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? "").trim().toLowerCase();
}

/** So para compor mensagens de erro na UI/API. */
export const ALLOWED_EMAIL_DOMAIN = dominioConfigurado();

/** true se o e-mail passa na restricao de dominio (ou se nao ha restricao). */
export function emailDominioPermitido(email: string): boolean {
  const dominio = dominioConfigurado();
  if (!dominio) return true;
  return email.trim().toLowerCase().endsWith(`@${dominio}`);
}
