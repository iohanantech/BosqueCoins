import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import { emailDominioPermitido } from "@/lib/auth/dominioEmail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LinhaPlanilha {
  linha: number;
  nome: string;
  email: string;
  turma: string;
  casa: string;
}

export type StatusLinha =
  | "ok"
  | "email_malformado"
  | "dominio_invalido"
  | "turma_inexistente"
  | "casa_inexistente"
  | "email_duplicado_planilha"
  | "email_ja_existe_banco";

export interface LinhaValidada extends LinhaPlanilha {
  status: StatusLinha;
  usuarioExistenteId?: string;
}

export function parsePlanilha(buffer: Buffer): LinhaPlanilha[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const primeiraAba = workbook.SheetNames[0];
  if (!primeiraAba) throw new ApiError(400, "Planilha vazia.");
  const sheet = workbook.Sheets[primeiraAba]!;
  const linhasBrutas = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  return linhasBrutas.map((linha, idx) => ({
    linha: idx + 2, // +2: cabecalho ocupa a linha 1, dados comecam na 2
    nome: String(linha.nome ?? "").trim(),
    email: String(linha.email ?? "").trim().toLowerCase(),
    turma: String(linha.turma ?? "").trim(),
    casa: String(linha.casa ?? "").trim(),
  }));
}

/**
 * Pre-visualizacao: valida linha a linha SEM gravar nada (secao 4.6).
 * Turma/Casa inexistente e sinalizado aqui; a decisao de criar automaticamente
 * ou rejeitar acontece no momento de confirmar a importacao (createOuRejeitar).
 */
export async function validarLinhas(linhas: LinhaPlanilha[]): Promise<LinhaValidada[]> {
  const turmasExistentes = new Set((await prisma.turma.findMany({ select: { nome: true } })).map((t) => t.nome));
  const casasExistentes = new Set((await prisma.casa.findMany({ select: { nome: true } })).map((c) => c.nome));
  const usuariosExistentes = await prisma.usuario.findMany({ select: { id: true, email: true } });
  const mapaUsuarios = new Map(usuariosExistentes.map((u) => [u.email, u.id]));

  const emailsVistos = new Set<string>();
  const resultado: LinhaValidada[] = [];

  for (const linha of linhas) {
    let status: StatusLinha = "ok";

    if (!EMAIL_REGEX.test(linha.email)) {
      status = "email_malformado";
    } else if (!emailDominioPermitido(linha.email)) {
      status = "dominio_invalido";
    } else if (emailsVistos.has(linha.email)) {
      status = "email_duplicado_planilha";
    } else if (!turmasExistentes.has(linha.turma)) {
      status = "turma_inexistente";
    } else if (linha.casa && !casasExistentes.has(linha.casa)) {
      status = "casa_inexistente";
    } else if (mapaUsuarios.has(linha.email)) {
      status = "email_ja_existe_banco";
    }

    emailsVistos.add(linha.email);
    resultado.push({ ...linha, status, usuarioExistenteId: mapaUsuarios.get(linha.email) });
  }

  return resultado;
}

export interface ConfirmarImportacaoOpcoes {
  linhas: LinhaValidada[];
  duplicados: "atualizar" | "pular";
  turmaCasaInexistente: "criar" | "rejeitar";
  anoLetivoId: string;
}

export interface ResumoImportacao {
  criados: number;
  atualizados: number;
  falharam: number;
  detalhesFalhas: { linha: number; motivo: string }[];
}

export async function confirmarImportacao(opcoes: ConfirmarImportacaoOpcoes): Promise<ResumoImportacao> {
  const resumo: ResumoImportacao = { criados: 0, atualizados: 0, falharam: 0, detalhesFalhas: [] };

  for (const linha of opcoes.linhas) {
    try {
      if (linha.status === "email_malformado" || linha.status === "dominio_invalido" || linha.status === "email_duplicado_planilha") {
        resumo.falharam++;
        resumo.detalhesFalhas.push({ linha: linha.linha, motivo: linha.status });
        continue;
      }

      if ((linha.status === "turma_inexistente" || linha.status === "casa_inexistente") && opcoes.turmaCasaInexistente === "rejeitar") {
        resumo.falharam++;
        resumo.detalhesFalhas.push({ linha: linha.linha, motivo: linha.status });
        continue;
      }

      if (linha.status === "email_ja_existe_banco" && opcoes.duplicados === "pular") {
        continue;
      }

      let turma = await prisma.turma.findUnique({ where: { nome: linha.turma } });
      if (!turma) {
        turma = await prisma.turma.create({ data: { nome: linha.turma, serie: linha.turma, ativo: true } });
      }

      let casaId: string | null = null;
      if (linha.casa) {
        let casa = await prisma.casa.findUnique({ where: { nome: linha.casa } });
        if (!casa) {
          casa = await prisma.casa.create({
            data: { nome: linha.casa, corPrimariaHex: "#999999", corSecundariaHex: "#666666" },
          });
        }
        casaId = casa.id;
      }

      if (linha.status === "email_ja_existe_banco" && linha.usuarioExistenteId) {
        await prisma.usuario.update({
          where: { id: linha.usuarioExistenteId },
          data: { nome: linha.nome, casaId: casaId ?? undefined },
        });
        await prisma.matricula.upsert({
          where: { alunoId_anoLetivoId: { alunoId: linha.usuarioExistenteId, anoLetivoId: opcoes.anoLetivoId } },
          update: { turmaId: turma.id },
          create: { alunoId: linha.usuarioExistenteId, turmaId: turma.id, anoLetivoId: opcoes.anoLetivoId },
        });
        resumo.atualizados++;
        continue;
      }

      const novoAluno = await prisma.usuario.create({
        data: { nome: linha.nome, email: linha.email, papel: "aluno", casaId },
      });
      await prisma.matricula.create({
        data: { alunoId: novoAluno.id, turmaId: turma.id, anoLetivoId: opcoes.anoLetivoId },
      });
      resumo.criados++;
    } catch (err) {
      resumo.falharam++;
      resumo.detalhesFalhas.push({ linha: linha.linha, motivo: err instanceof Error ? err.message : "erro desconhecido" });
    }
  }

  return resumo;
}
