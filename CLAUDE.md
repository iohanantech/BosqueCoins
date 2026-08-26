# CLAUDE.md — BosqueCoins

Guia de contexto do projeto para quem (humano ou IA) for continuar este trabalho.

## Status (Continuação — Fase 6, revisão final)

Todas as 6 fases do `CONTINUACAO.md` foram concluídas. Suíte completa limpa: `npm run typecheck`, `npm run lint`, `npm run test` (30), `npm run test:integration` (25), `npm run test:e2e` (12) — todos passando, verificado contra um Postgres 17 local de verdade (não simulado). Ver as seções "Continuação — Fase N" abaixo para o detalhe de cada uma.

**Nota sobre `ESPECIFICACAO.md`**: o `CONTINUACAO.md` original referencia esse arquivo (seção 13 - critérios de aceite) como já presente no repositório, mas ele **não existe** neste checkout — só `CLAUDE.md` e `README.md`. A revisão desta Fase 6 foi feita contra a tabela de RN-01..RN-14 deste arquivo (que é a fonte de verdade prática do projeto), não contra a especificação original seção por seção. Se `ESPECIFICACAO.md` aparecer depois, vale revisitar a seção 13 diretamente.

**Bugs reais encontrados e corrigidos** (não apenas lacunas - comportamento errado que existia no código):
1. `src/lib/services/anoLetivoService.ts` não existia, apesar de referenciado pela rota `/api/anos-letivos/encerrar` e documentado na tabela de RNs (Fase 1).
2. `GET /api/redemptions` nunca retornava para o PEC os resgates individuais dos alunos das turmas que ele administra - só os de escopo turma - mesmo o PEC tendo permissão de aprová-los (Fase 4, achado pelo teste E2E de resgate).
3. `rankingService.ts` tinha um `include` do Prisma inválido que quebraria em runtime assim que `prisma generate` rodasse de verdade (Fase 1).

**O que ainda depende de credenciais reais do usuário** (não pode ser validado neste ambiente):
- Login Google OAuth real (Client ID/Secret) contra o domínio `@bosquemananciais.org.br` de produção - o fluxo até a tela de erro do Google foi confirmado manualmente (ver Fase 2), mas não um login bem-sucedido de verdade.
- Neon Postgres real (usamos Postgres 17 local via winget para todo o trabalho de verificação, seguindo a instrução do `CONTINUACAO.md` para quando faltar credencial real).
- Deploy em produção (Vercel/Netlify) e o checklist de variáveis de ambiente do `README.md` seção 4.

## Stack

- **Next.js 14 (App Router) + TypeScript**, front e back no mesmo projeto.
- **PostgreSQL + Prisma** (schema em `prisma/schema.prisma`).
- **NextAuth.js (Auth.js)** com provider Google, JWT session.
- **Tailwind CSS** com tokens customizados (dourado + 4 cores das Casas) em `tailwind.config.ts`; componentes de UI escritos à mão em estilo shadcn (`src/components/ui`) — não usamos o CLI do shadcn para não depender de um registry externo em runtime.
- **Zod** para validação de payloads, compartilhada entre schemas (`src/lib/validation/schemas.ts`) e serviços.
- **Vitest** para testes unitários das regras de negócio.
- **SheetJS (`xlsx`)** para leitura de planilhas de importação.

## Comandos

```bash
npm install              # instala dependências (roda `prisma generate` via postinstall)
npm run dev               # servidor de desenvolvimento
npm run build              # build de produção
npm run typecheck          # tsc --noEmit
npm run lint                # eslint
npm run test                 # vitest run (regras de negócio - RN-01..RN-14, sem banco)
npm run test:integration      # vitest run contra Postgres real - ver tests/integration/README.md
npm run test:e2e              # Playwright E2E - ver tests/e2e/README.md
npm run icons:generate         # regenera public/icons/icon-{192,512}.png a partir do CoinIcon
npm run prisma:migrate        # cria/aplica migration em dev
npm run prisma:deploy          # aplica migrations em produção
npm run prisma:seed             # popula o banco com dados de desenvolvimento
npm run prisma:studio            # abre o Prisma Studio
```

## Estrutura de pastas

```
prisma/
  schema.prisma        # modelo de dados (secao 8 da especificacao)
  seed.ts               # dados ficticios de desenvolvimento (Fase 2)
src/
  app/
    (auth)/login/        # tela de login (fora do shell autenticado)
    (app)/                # shell autenticado: bottom nav + top header
      dashboard/            # rankings (secao 4.1)
      pontuar/               # distribuicao de pontos (secao 4.2)
      extrato/                # extrato (secao 4.5)
      premios/                 # catalogo + resgate (secao 4.3, 4.4)
      perfil/
      pec/                      # painel do PEC (secao 2)
      admin/                     # paineis exclusivos de admin
    api/                          # rotas de API (uma pasta por recurso)
  components/
    ui/                # primitives (button, card, input, badge...)
    dashboard/          # cards de ranking
    layout/              # bottom nav, header, aviso desktop
  lib/
    auth/                 # NextAuth config + helpers de autorizacao (requireSession, requirePapel...)
    services/               # logica de negocio (ver abaixo)
    validation/              # schemas Zod compartilhados
  middleware.ts               # protecao de PAGINAS por papel (camada de UX; a validacao real é sempre no backend)
tests/unit/regras.test.ts        # 30 testes cobrindo RN-01..RN-14
```

## Arquitetura da camada de serviços (`src/lib/services`)

Separação deliberada entre **regras puras** e **I/O**, para permitir testar a lógica de negócio sem precisar de um banco de dados real:

- **`regras.ts`** — funções puras (entrada → saída, sem `await`, sem Prisma). Cobre os cálculos de RN-01, RN-03, RN-04, RN-05, RN-06, RN-09, RN-12, RN-13, RN-14 e a ordenação de rankings. É o arquivo com testes unitários (`tests/unit/regras.test.ts`, 30 testes, todos passando).
- **`pointsService.ts`** — orquestra `regras.ts` + Prisma dentro de `prisma.$transaction` (RN-02, atomicidade). Contém `distribuirPontos` (individual em lote / turma toda), `pontuarProfessor` (RN-12/13), `ajustarSaldoTurma` (RN-05).
- **`redemptionService.ts`** — `solicitarResgate` e `resolverResgate` (RN-04, RN-06, controle de estoque).
- **`rankingService.ts`** — monta os rankings de Salas/Casas e o contexto pessoal do dashboard.
- **`importService.ts`** — parse (`xlsx`), validação linha a linha e confirmação da importação (seção 4.6).
- **`anoLetivoService.ts`** — encerramento do ano letivo (seção 5).

## Regras de negócio (RN-01 a RN-14)

Todas implementadas e comentadas no código-fonte, no arquivo/função correspondente. Resumo de onde encontrar cada uma:

| Regra | Onde |
|---|---|
| RN-01 Propagação tripla | `regras.ts::calcularPropagacaoCredito`, aplicado em `pointsService.ts::distribuirPontos` |
| RN-02 Atomicidade | `prisma.$transaction` em `pointsService.ts` e `redemptionService.ts` |
| RN-03 Motivo obrigatório | `regras.ts::validarMotivo`, também `NOT NULL` implícito no schema (`motivo: string`) |
| RN-04 Resgate individual isolado | `regras.ts::calcularDebitoResgateIndividual`, `redemptionService.ts::resolverResgate` |
| RN-05 Ajustes de PEC | `regras.ts::calcularAjusteTurma`, `pointsService.ts::ajustarSaldoTurma` |
| RN-06 Saldo nunca negativo | `regras.ts::validarDebitoNaoNegativo`, checado na aprovação do resgate e no ajuste de débito |
| RN-07 Auditoria imutável | Nenhuma rota de DELETE/UPDATE em `transacoes`/`resgates` — só criação e (para resgates) transição de status |
| RN-08 Privacidade do aluno | `src/lib/auth/server.ts::garantirAcessoProprioOuAdmin` |
| RN-09 Escopo do PEC | `regras.ts::validarEscopoPec`, checado em `pointsService.ts::ehPecDaTurma` antes de ajustes/aprovações |
| RN-10 Domínio de e-mail | `src/lib/auth/options.ts::signIn` callback |
| RN-11 Escopo por ano letivo | Toda leitura de `turma_periodos`/`casa_periodos` recebe `anoLetivoId` explícito; nunca há soma cross-year |
| RN-12 Só admin pontua professor | `regras.ts::validarQuemPontuaProfessor` |
| RN-13 Professor fora dos rankings | `regras.ts::excluirProfessoresDoRanking`; `rankingService.ts` só lê `turma_periodos`/`casa_periodos`, que nunca recebem incremento de professor |
| RN-14 Limite de 10 por lote | `regras.ts::validarLimiteValorPorLote` |

## Pressupostos assumidos (seção 12 da especificação)

1. **Cores hex das Casas** são aproximações (documentadas em `tailwind.config.ts` e no seed): Camapuã `#B8860B`/`#8B0000`, Caratuva `#0B3D91`/`#00B7C3`, Marumbi `#F5E050`/`#111111`, Morro do Cal `#14532D`/`#4ADE80`.
2. "Zerar pontos" e "encerrar o ano letivo" são a **mesma ação** — implementado como uma única chamada (`anoLetivoService.ts::encerrarAnoLetivo`).
3. Seed usa turmas de 5/8/12 alunos para validar visualmente o modo "média".
4. O limite de 10 pontos do professor comum é avaliado **por lote**, sem teto agregado por dia/período.
5. A exceção de PEC (sem limite) vale só nas turmas administradas por ele naquele ano letivo — checado via `professor_pec_turmas`.

## ⚠️ Limitação conhecida deste ambiente de build (histórico)

Este projeto foi montado originalmente num ambiente sandbox sem acesso de rede a `binaries.prisma.sh`, então `prisma generate` nunca tinha rodado e o TypeScript nunca tinha sido checado contra os tipos reais do Prisma Client. **Isso já foi corrigido** (ver "Continuação — Fase 1" abaixo); `npm install` + `npm run typecheck` + `npm run lint` rodam limpos agora. Histórico mantido aqui só para contexto de por que certos ajustes (ex.: `Turma.nome` virou `@unique`) foram feitos.

## Continuação — Fase 1 (correções de compilação)

Divergências entre o código escrito à mão e os tipos reais gerados pelo Prisma, corrigidas:

- `Turma.nome` não era `@unique` no schema, mas `seed.ts` e `importService.ts` faziam `upsert`/`findUnique` por `nome` — adicionado `@unique` (decisão: nomes de turma são de fato únicos no domínio).
- `src/lib/services/anoLetivoService.ts` **não existia** (referenciado por `src/app/api/anos-letivos/encerrar/route.ts` e documentado na tabela de RNs, mas nunca foi escrito) — implementado do zero: `encerrarAnoLetivo` marca o ano ativo como encerrado, cria o próximo já ativo; não mexe em `Usuario.saldoAtual/saldoAcumulado` (vitalício) nem apaga `TurmaPeriodo`/`CasaPeriodo` do ano anterior.
- `rankingService.ts` tinha um `include: { _count: { select: {} } }` inválido (sobra de uma versão anterior) — removido; a contagem de alunos já é feita via `prisma.matricula.count` separado.
- `importService.ts`: `workbook.Sheets[primeiraAba]` podia ser `undefined` para o TS — non-null assertion após o guard de planilha vazia já feito acima.
- `.eslintrc.json` não carregava o plugin `@typescript-eslint` fora do fluxo padrão do Next (rule override `@typescript-eslint/no-unused-vars` falhava com "rule not found" via `npm run lint`) — adicionado `"plugins": ["@typescript-eslint"]` explicitamente.

## Continuação — Fase 5 (itens pendentes)

Os 3 itens da antiga seção "O que ficou pendente" (abaixo) foram resolvidos:

1. **Filtros avançados do extrato do admin** — nova tela `/admin/extrato` (link no hub `/admin`), com UI de fato (não só query string): ano letivo, tipo de transação, turma, Casa, professor (origem), intervalo de datas. `GET /api/extrato` ganhou os parâmetros `casaId`, `tipo`, `dataInicio`, `dataFim` (o filtro por Casa resolve os alunos daquela Casa primeiro, já que `destinoId` não é uma FK tipada no schema). Também corrigido de passagem: o filtro por `turmaId` não fixava `destinoTipo: "turma"` explicitamente (funcionava por não haver colisão de UUID entre aluno/turma, mas estava semanticamente incompleto).
2. **Ícones do PWA** — `scripts/generate-icons.mjs` (usa `sharp`, devDependency) gera `icon-192.png`/`icon-512.png` a partir do MESMO SVG/gradiente de `CoinIcon` (`src/components/ui/coin-icon.tsx`), então o ícone do PWA agora é visualmente idêntico ao ícone usado dentro do app. Rodar `npm run icons:generate` depois de qualquer mudança visual no `CoinIcon`.
3. **PEC de múltiplas turmas simultaneamente** — já funcionava (o schema já suporta múltiplas linhas de `professor_pec_turmas` por professor/ano), mas não tinha teste dedicado. Adicionado `tests/integration/pecMultiTurma.test.ts` (4 testes): sem limite de RN-14 em nenhuma das turmas administradas, ajuste manual de saldo funciona nas duas, `GET /api/redemptions` mostra os resgates (turma e individuais) das duas turmas, e RN-09 continua bloqueando uma terceira turma não administrada.

## Continuação — Fase 4 (Playwright E2E)

`tests/e2e/` (config em `playwright.config.ts`, script `npm run test:e2e`) - 12 testes, todos passando, cobrindo:

- Login e navegação por papel (admin/professor/PEC/aluno) - bottom nav e conteúdo corretos por papel.
- Fluxo completo de "Pontuar": turma → 3 alunos → valor/motivo → confirmar → extrato do professor mostra 1 lote agrupado e expansível.
- Fluxo completo de resgate individual: aluno solicita → PEC aprova → saldo do aluno cai (via `data-testid="saldo-pessoal-atual"` em `dashboard/page.tsx`, único hook de teste adicionado ao código de produção).
- Fluxo completo de importação: upload de `.xlsx` gerado em memória (`xlsx` package) → pré-visualização por linha com status → confirmar → resumo bate com o esperado.
- Fluxo de encerramento de ano letivo → dashboard mostra o ano novo zerado e o anterior consultável. **Roda por último** (arquivo `zz-ano-letivo.spec.ts`, de propósito - fecha o ano ativo e por isso quebraria os testes seguintes se rodasse antes, já que `Matricula` é escopada por ano letivo).
- Os 3 breakpoints da seção 9 (375/768/1280) via `page.setViewportSize()` dentro de `responsive.spec.ts`, não como projects separados (evita triplicar a suíte inteira).

**Bug real encontrado e corrigido nesta fase**: `GET /api/redemptions` só retornava para o PEC os resgates de escopo `turma`, nunca os `individual` dos alunos das turmas que ele administra - mesmo o PEC tendo permissão de aprová-los (`redemptionService.ts::resolverResgate` já cobria esse caso). Corrigido em `src/app/api/redemptions/route.ts` (agora inclui `OR` com os `alunoId` matriculados nas turmas do PEC).

**Decisão de infraestrutura**: o `webServer` do Playwright roda com `next dev`, não build de produção - tentei build+start primeiro para eliminar a flakiness de compilação sob demanda, mas isso quebra o provider de login de dev *por design* (`DEV_AUTH_ENABLED` é ignorado quando `NODE_ENV=production`, ver Fase 2 - correto, não deve ser contornado). Em vez disso, `tests/e2e/global-setup.ts` "esquenta" as rotas principais antes da suíte começar, e `playwright.config.ts` tem `retries: 1` para absorver flakiness residual do dev server (ex.: um Fast Refresh completo).

Banco dedicado: `bosquecoins_e2e` (nunca o de dev), migrado e semeado manualmente antes de rodar - ver `tests/e2e/README.md`.

## Continuação — Fase 3 (testes de integração)

`tests/integration/` (config separada em `vitest.integration.config.mts`, script `npm run test:integration`) cobre contra um Postgres real (local, `bosquecoins_test` - nunca o de dev) o que a suíte de `regras.ts` não alcança por não tocar banco:

- **RN-01 + RN-02**: `distribuirPontos` credita aluno/turma/Casa atomicamente, uma transação por aluno com `loteId` compartilhado.
- **RN-04 + RN-06**: resgate individual só debita o saldo atual do aluno (não mexe em acumulado/turma/Casa); aprovação que deixaria saldo negativo falha sem alterar nada (testado para resgate individual e de turma).
- **RN-08**: via API real (`POST /api/redemptions` com sessão mockada) — aluno não pode solicitar resgate em nome de outro aluno.
- **RN-09**: via API real (`POST /api/points/turma`) — professor comum ou PEC de outra turma recebe 403 num ajuste manual; PEC da turma certa consegue.
- **RN-12 + RN-13**: só admin credita professor; crédito de professor não propaga para turma/Casa nem entra nos rankings.
- **RN-05, RN-14**: ajuste de PEC isolado na turma; limite de 10/lote para professor comum, sem limite para PEC/admin, e o mesmo professor volta ao limite numa turma que não administra.
- **Encerramento de ano letivo**: novo ano fica ativo e zerado, o anterior vira `encerrado` e continua consultável com os valores intactos, saldo pessoal não muda. Também documenta que `Matricula` é escopada por ano (RN-11) — não é herdada automaticamente, precisa de reimportação (comportamento correto, não um bug).
- **Importação de planilha**: todos os `StatusLinha` (`email_malformado`, `dominio_invalido`, `turma_inexistente`, `casa_inexistente`, `email_duplicado_planilha`, `email_ja_existe_banco`) classificados corretamente; `confirmarImportacao` respeita `criar`/`rejeitar` e `atualizar`/`pular`.

RN-03, RN-06 (validação pura), RN-07 (ausência de rotas DELETE/UPDATE — verificável por inspeção, não por teste), RN-10 e RN-13 (exclusão de ranking) já têm cobertura suficiente em `regras.ts` ou são estruturais; não duplicados aqui.

`tests/integration/setup.ts` recusa rodar se `DATABASE_URL` não contiver `"test"` (proteção contra `TRUNCATE` no banco errado) e faz `TRUNCATE ... RESTART IDENTITY CASCADE` antes de cada teste via `resetDb()`. Ver `tests/integration/README.md` para setup local.

## Continuação — Fase 2 (login de desenvolvimento)

Adicionado um `CredentialsProvider` (`id: "dev"`) em `src/lib/auth/options.ts`, ativo só quando `NODE_ENV !== "production" && process.env.DEV_AUTH_ENABLED === "true"` (flag `DEV_AUTH_ENABLED` exportada de lá). Ele só autentica e-mails que já existem em `usuarios` (sem senha), reaproveitando a mesma checagem de conta ativa que o login real — não é um atalho para RN-08/RN-09/RN-12. `GET /api/dev/usuarios` (também gated pela mesma flag, 404 caso contrário) alimenta um seletor na tela `/login` (`DevLoginPicker`). Ver seção 2.2.1 do `README.md` para como habilitar/desabilitar.

## O que ficou pendente / próximos passos sugeridos

- Testes de integração reais contra Postgres, filtros avançados do extrato do admin, Playwright E2E e ícones PWA finais — todos resolvidos, ver "Continuação — Fase 3/4/5" acima.
- Upload de imagem do catálogo fica fora de escopo por design (custo zero — seção 7); campo `imagemUrl` aceita link externo.
- Validação contra Google OAuth real e Neon Postgres real ainda depende de credenciais que só o usuário possui (ver README.md) — todo o resto foi validado contra Postgres local.
