import { z } from "zod";

// Schemas Zod compartilhados entre frontend (formularios) e backend (API routes).

export const distribuirPontosSchema = z.object({
  turmaId: z.string().uuid(),
  alunoIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um aluno."),
  valor: z.number().int().positive("O valor deve ser um numero inteiro positivo."),
  motivo: z.string().trim().min(1, "O motivo e obrigatorio."),
  // Sem campo `data`: o timestamp do lancamento e sempre o do servidor
  // (RN-07). Ver achado P5 da auditoria (Fase 15).
});

export const pontuarProfessorSchema = z.object({
  professorDestinoId: z.string().uuid(),
  valor: z.number().int().positive(),
  motivo: z.string().trim().min(1, "O motivo e obrigatorio."),
});

export const ajustarSaldoTurmaSchema = z.object({
  turmaId: z.string().uuid(),
  valor: z.number().int().positive(),
  direcao: z.enum(["credito", "debito"]),
  motivo: z.string().trim().min(1, "O motivo e obrigatorio."),
});

export const criarItemCatalogoSchema = z.object({
  nome: z.string().trim().min(1),
  descricao: z.string().trim().min(1),
  custo: z.number().int().positive(),
  imagemUrl: z.string().url().optional().nullable(),
  icone: z.string().optional().nullable(),
  categoria: z.string().trim().min(1),
  escopo: z.enum(["turma", "individual", "ambos"]),
  quantidadeDisponivel: z.number().int().positive().optional().nullable(),
  ativo: z.boolean().optional(),
});

export const solicitarResgateSchema = z.object({
  itemId: z.string().uuid(),
  escopo: z.enum(["turma", "individual"]),
  turmaId: z.string().uuid().optional(),
  alunoId: z.string().uuid().optional(),
});

export const resolverResgateSchema = z.object({
  decisao: z.enum(["aprovado", "recusado"]),
  motivoRecusa: z.string().optional(),
});

export const encerrarAnoSchema = z
  .object({
    nomeProximoAno: z.string().trim().min(1),
    dataInicioProximoAno: z.coerce.date(),
    dataFimProximoAno: z.coerce.date(),
  })
  .refine((d) => d.dataFimProximoAno > d.dataInicioProximoAno, {
    message: "A data de fim precisa ser depois da data de inicio.",
    path: ["dataFimProximoAno"],
  });

// Abertura do PRIMEIRO ano letivo (so quando nao existe nenhum) - ver
// anoLetivoService.ts::abrirPrimeiroAnoLetivo. Depois disso, a virada de ano
// e sempre por encerrarAnoSchema acima, que fecha o vigente e abre o proximo.
export const criarAnoLetivoSchema = z
  .object({
    nome: z.string().trim().min(1, "O nome e obrigatorio."),
    dataInicio: z.coerce.date(),
    dataFim: z.coerce.date(),
  })
  .refine((d) => d.dataFim > d.dataInicio, {
    message: "A data de fim precisa ser depois da data de inicio.",
    path: ["dataFim"],
  });

// Investir em Casa/turma sempre mira a PROPRIA Casa/turma do aluno (nunca uma
// escolhida livremente) - resolvida no service a partir de usuarios.casa_id e
// da matricula do ano vigente, nao recebida como parametro (evita um aluno
// inflar o placar de uma turma/Casa que nao e a dele).
export const investirSchema = z.object({
  tipo: z.enum(["casa", "turma", "cdb", "poupanca", "fundo_imobiliario", "tesouro_direto", "dizimo", "lar_idoso"]),
  valor: z.number().int().positive("O valor deve ser um numero inteiro positivo."),
  alunoId: z.string().uuid().optional(), // so quando admin investe em nome do aluno (RN-15)
});

// Presentear (PRESENTES.md, RN-23..RN-27). O corpo NAO carrega `valor` - e
// sempre VALOR_PRESENTE (10), fixado no backend (RN-24). O remetente tambem
// nunca vem do corpo: e sempre session.user.id (RN-08 - ninguem presenteia
// "em nome de" outro aluno).
export const enviarPresenteSchema = z.object({
  destinatarioId: z.string().uuid(),
  mensagem: z.string().trim().max(60, "O recado deve ter no maximo 60 caracteres.").optional(),
});

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Cor precisa estar no formato hexadecimal, ex.: #D4AF37.");

export const criarCasaSchema = z.object({
  nome: z.string().trim().min(1, "O nome e obrigatorio."),
  corPrimariaHex: hexColorSchema,
  corSecundariaHex: hexColorSchema,
});

export const editarCasaSchema = criarCasaSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const criarTurmaSchema = z.object({
  nome: z.string().trim().min(1, "O nome e obrigatorio."),
  serie: z.string().trim().min(1, "A serie e obrigatoria."),
});

export const editarTurmaSchema = criarTurmaSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const criarProfessorSchema = z.object({
  nome: z.string().trim().min(1, "O nome e obrigatorio."),
  email: z.string().trim().toLowerCase().email("E-mail invalido."),
  // Turmas onde esse professor ja entra como PEC (RN-09) no ano letivo vigente - opcional.
  turmasPecIds: z.array(z.string().uuid()).optional().default([]),
});

export const criarAdminSchema = z.object({
  nome: z.string().trim().min(1, "O nome e obrigatorio."),
  email: z.string().trim().toLowerCase().email("E-mail invalido."),
});

// Cadastro individual de aluno (alternativa a importar planilha). A turma e
// obrigatoria (um aluno sempre pertence a uma turma - Matricula, RN-11):
// ou aponta uma existente por `turmaId`, ou passa `turmaNome` para criar uma
// nova na hora (mesmo comportamento do fluxo de importacao). Casa e opcional.
export const criarAlunoSchema = z
  .object({
    nome: z.string().trim().min(1, "O nome e obrigatorio."),
    email: z.string().trim().toLowerCase().email("E-mail invalido."),
    turmaId: z.string().uuid().optional(),
    turmaNome: z.string().trim().min(1).optional(),
    casaId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.turmaId) || Boolean(d.turmaNome), {
    message: "Informe a turma: selecione uma existente ou digite o nome de uma nova.",
    path: ["turmaId"],
  });

export const alterarAdminSchema = z.object({
  ativo: z.boolean(),
});

export const atribuirAlunosTurmaSchema = z.object({
  alunoIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um aluno."),
});

export const removerAlunoTurmaSchema = z.object({
  alunoId: z.string().uuid(),
});

export const confirmarImportacaoSchema = z.object({
  anoLetivoId: z.string().uuid(),
  duplicados: z.enum(["atualizar", "pular"]),
  turmaCasaInexistente: z.enum(["criar", "rejeitar"]),
});

// So os campos "crus" da planilha - status e usuarioExistenteId sao
// recalculados no servidor (ver /api/import/confirmar), nunca confiados do
// payload: o cliente que devolve esses dois campos e o mesmo que os recebeu
// da pre-visualizacao, entao um payload forjado poderia declarar qualquer
// linha como "ok" ou apontar usuarioExistenteId para outra conta.
export const linhaImportacaoSchema = z.object({
  linha: z.number().int(),
  nome: z.string(),
  email: z.string(),
  turma: z.string(),
  casa: z.string(),
});
