# CLAUDE.md — BosqueCoins

Guia de contexto do projeto para quem (humano ou IA) for continuar este trabalho.

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
npm run test                 # vitest run (regras de negócio - RN-01..RN-14)
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

## ⚠️ Limitação conhecida deste ambiente de build

Este projeto foi montado num ambiente sandbox sem acesso de rede a `binaries.prisma.sh`, então **`prisma generate` nunca rodou aqui** — o código que depende de `@prisma/client` foi escrito à mão, sem o compilador confirmando os tipos gerados. Isso **não deve ser um problema no seu ambiente** (Claude Code, ou `npm install` local/CI com internet completa), já que o `postinstall` do `package.json` roda `prisma generate` automaticamente. Ainda assim, rode `npm run typecheck` como primeiro passo depois de clonar, e corrija qualquer divergência de tipo que aparecer — a lógica de negócio (regras.ts) já está 100% testada e não depende do Prisma.

## O que ficou pendente / próximos passos sugeridos

- Testes de integração reais contra Postgres (ex.: com Testcontainers) cobrindo os critérios de aceite end-to-end (login, RN-08, RN-09 via API).
- Tela de detalhe/filtros avançados do extrato do admin (atualmente filtra só por `turmaId`/`professorId` via query string).
- Upload de imagem do catálogo fica fora de escopo por design (custo zero — seção 7); campo `imagemUrl` aceita link externo.
- Playwright E2E (marcado como opcional na especificação).
- Ícones PWA (`public/icons/icon-192.png`, `icon-512.png`) foram gerados de forma simples e programática — vale trocar por uma arte final antes de publicar.
