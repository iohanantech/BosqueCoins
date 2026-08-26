#!/usr/bin/env node
/**
 * Gera public/templates/modelo-importacao.xlsx (versao .xlsx do mesmo
 * modelo.csv), pra oferecer download nos dois formatos aceitos pela
 * importacao (secao 4.6). Rode com: node scripts/generate-import-template.mjs
 * Rode de novo sempre que as colunas esperadas por importService.ts mudarem.
 */
import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "templates");
mkdirSync(outDir, { recursive: true });

const linhas = [
  { nome: "Maria Ficticia Exemplo", email: "maria.exemplo@bosquemananciais.org.br", turma: "Turma 1A", casa: "Camapuã" },
  { nome: "Joao Ficticio Exemplo", email: "joao.exemplo@bosquemananciais.org.br", turma: "Turma 2B", casa: "Caratuva" },
];

const planilha = XLSX.utils.book_new();
const aba = XLSX.utils.json_to_sheet(linhas);
XLSX.utils.book_append_sheet(planilha, aba, "Alunos");

const arquivo = path.join(outDir, "modelo-importacao.xlsx");
XLSX.writeFile(planilha, arquivo);
console.log(`Gerado ${arquivo}`);
