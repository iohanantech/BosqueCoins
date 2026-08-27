import { describe, it, expect, afterEach } from "vitest";
import { emailDominioPermitido } from "@/lib/auth/dominioEmail";

const original = process.env.ALLOWED_EMAIL_DOMAIN;
afterEach(() => {
  if (original === undefined) delete process.env.ALLOWED_EMAIL_DOMAIN;
  else process.env.ALLOWED_EMAIL_DOMAIN = original;
});

describe("emailDominioPermitido (RN-10 opcional)", () => {
  it("sem ALLOWED_EMAIL_DOMAIN: qualquer dominio passa (Gmail, Outlook...)", () => {
    delete process.env.ALLOWED_EMAIL_DOMAIN;
    expect(emailDominioPermitido("fulano@gmail.com")).toBe(true);
    expect(emailDominioPermitido("ciclana@outlook.com")).toBe(true);
    expect(emailDominioPermitido("prof@bosquemananciais.org.br")).toBe(true);
  });

  it("ALLOWED_EMAIL_DOMAIN vazio: idem, sem restricao", () => {
    process.env.ALLOWED_EMAIL_DOMAIN = "  ";
    expect(emailDominioPermitido("fulano@gmail.com")).toBe(true);
  });

  it("ALLOWED_EMAIL_DOMAIN definido: so aquele dominio passa", () => {
    process.env.ALLOWED_EMAIL_DOMAIN = "bosquemananciais.org.br";
    expect(emailDominioPermitido("prof@bosquemananciais.org.br")).toBe(true);
    expect(emailDominioPermitido("PROF@Bosquemananciais.org.br")).toBe(true); // case-insensitive
    expect(emailDominioPermitido("fulano@gmail.com")).toBe(false);
  });
});
