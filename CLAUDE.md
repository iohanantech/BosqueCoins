# CLAUDE.md — BosqueCoins

Guia de contexto do projeto para quem (humano ou IA) for continuar este trabalho.

## Continuação — Fase 15 (auditoria completa: abrir o 1º ano letivo + correções)

Auditoria de todo o sistema em 2026-08-27 (relatório completo publicado como artifact). Corrigido nesta sessão o achado **crítico** e dois **baixos** de origem relacionada:

**P1 (crítico) — um banco novo era um beco sem saída.** A única rota que criava `AnoLetivo` era `POST /api/anos-letivos/encerrar`, que exige um ano ativo pra rodar — e ~10 rotas dependem de `getAnoLetivoAtivo` (dashboard, cadastro de aluno, extrato, turmas…), todas 500/404 sem ano. A única saída era `prisma:seed` (25 alunos fictícios). Agora:
- `anoLetivoService.ts::abrirPrimeiroAnoLetivo` — cria o ano ativo, **só quando `anoLetivo.count() === 0`** (409 caso contrário; a partir do 2º ano a virada é sempre por `encerrarAnoLetivo`).
- `GET/POST /api/anos-letivos` (novo arquivo `route.ts`, ao lado de `/encerrar`). GET é para qualquer sessão e devolve `{ total, temAtivo, anos }`; POST é admin-only.
- `/admin/ano-letivo` agora tem duas caras: sem nenhum ano → formulário "Abrir o primeiro ano letivo"; com ano → o fluxo de encerrar de sempre. Detecta via `GET /api/anos-letivos`.
- Dashboard: quando `/api/dashboard/rankings` volta 404 (sem ano), mostra um card "Nenhum ano letivo aberto" com CTA pro admin, em vez de "Carregando rankings…" pra sempre.

**P8 (baixo) — datas invertidas aceitas.** `encerrarAnoSchema` e o novo `criarAnoLetivoSchema` ganharam `.refine()` exigindo `dataFim > dataInicio` (400 antes de gravar).

**Bug pego pela suíte durante a auditoria — `diasDecorridos` podia ser -1.** Em `investmentService.ts`, o cálculo de dias desde o investimento (`Date.now() - dataInvestimento`) dava -1 por milissegundos de defasagem entre o relógio do app e o `now()` do Postgres num investimento recém-criado — fazendo a carência RN-28 "faltar 1 dia" até pra poupança (carência 0) e os juros ficarem negativos. Extraído `diasAplicado()` que trava em 0, usado nos 3 pontos (resgatar, listar, resumo).

**E2E revalidado.** A suíte Playwright não rodava desde a Fase 4; contra um `bosquecoins_e2e` recriado do zero, `investir.spec.ts` estava quebrado (a Fase 14 clicava em "Resgatar" logo após investir em CDB, botão que a carência de 30 dias removeu; e o helper `lerSaldo` lia `NaN` durante o "…" de carregamento). Corrigido + teste novo cobrindo o "Resgate em 30d". **15/15 E2E, 50 unit, 103 integração, `typecheck`/`lint` limpos.**

Ainda em aberto do relatório (não corrigidos): xlsx com CVEs sem patch no npm (P3), papel não validado em `/api/admin/pec-turmas` (P4), campo `data` do cliente aceito em `distribuirPontos` (P5), busca de alunos enumerável (P6), sem rate limiting (P7), N+1 no ranking (P9).

## Continuação — Fase 14 (carência de resgate por tipo de investimento — RN-28)

Cada investimento reversível agora tem um prazo mínimo de aplicação antes de poder ser resgatado: **poupança 0** (a qualquer hora), **Fundo Imobiliário 7 dias** (1x/semana), **Tesouro Direto 15 dias**, **CDB 30 dias** (1x/mês). Números em `CARENCIA_RESGATE_DIAS` (`taxasInvestimento.ts`), ao lado de `TAXAS_MENSAIS`. **Não** é congelada no momento do investimento (diferente da taxa, RN-18) — é regra do jogo, mudar o config vale pra todos os ativos; documentado no próprio config.

`regras.ts::validarCarenciaResgate(diasDecorridos, carenciaDias)` (puro). `resgatarInvestimento` chama depois de `validarPodeResgatar` e antes de mexer em saldo — 400 com "faltam N" se não cumpriu. `listarInvestimentos` passou a devolver `carenciaDias` e `diasRestantesCarencia` por investimento ativo; `/investir` usa isso pra, no card do investimento ativo, trocar o botão "Resgatar" por "Resgate em Nd" enquanto trava, e mostra a carência em cada opção (linha "🔓 resgate a partir de N dias" + no texto de `instrucoes-investimento.tsx`, seção "Como investir bem"). A virtude "Diligência e paciência" ganhou uma frase citando o prazo.

Teste de corrida de resgate (`concorrencia.test.ts`) trocado de CDB→poupança (carência 0) pra continuar exercitando a corrida sem esbarrar no novo prazo. `typecheck`/`lint`/`test`(50)/integração(99) limpos.

## Continuação — Fase 13 (taxas de investimento ao mês)

As taxas dos investimentos reversíveis (CDB 11%, Poupança 6%, Fundo Imobiliário 9%, Tesouro Direto 10,5%) agora são **ao mês**, não ao ano. Motivo: num uso de escola (semanas), a taxa anual composta diária mal movia o inteiro do saldo — BosqueCoins não têm fração e o `Math.round` de `calcularValorComJuros` só sobe de 1 quando o juro passa de 0,5, o que levava dezenas de dias corridos. Ao mês, o rendimento aparece em poucos dias.

`TAXAS_ANUAIS` → `TAXAS_MENSAIS` (`taxasInvestimento.ts`, mesmos números, novo significado). `calcularValorComJuros(principal, taxaMensal, dias)` converte de mensal pra diária assumindo mês de 30 dias (`(1+taxaMensal)^(1/30)-1`), então 30 dias rendem exatamente `principal*(1+taxaMensal)`. Campo do schema `Investimento.taxaAnual` → `taxaMensal` (`@map("taxa_mensal")`), migration `20260827114335_renomeia_taxa_anual_para_mensal` — **rename de coluna, sem perda de dados** (o SQL gerado pelo Prisma seria DROP+ADD; foi reescrito à mão como `RENAME COLUMN`). UI `/investir`: badge `% a.m.` (era `% a.a.`) e o aviso das taxas fictícias agora diz "ao mês". A taxa continua congelada no momento do investimento (RN-18) — investimentos antigos mantêm o número que tinham, só reinterpretado como mensal. `typecheck`/`lint`/`test`(46)/integração(85) limpos.

## Continuação — Fase 12 (Presentear: transferência entre alunos)

`PRESENTES.md` aplicado. Um aluno pode **presentear outro aluno** com BosqueCoins do próprio saldo: digita o nome do colega (autocomplete `GET /api/alunos/busca`, escopado a `papel = 'aluno'` ativos e nunca a si mesmo, com a turma do ano vigente pra desambiguar homônimos), o valor é **fixo em 10** (RN-24 — sem campo livre, sem escolha de opções), confirma, e a transferência é **instantânea** (sem fluxo de aprovação, diferente do resgate do catálogo). Recadinho opcional de até 60 caracteres.

**MULTIESCOLA.md não estava aplicado** neste checkout, então o modelo `Presente` **não tem `escolaId`** e as regras foram numeradas **RN-23..RN-27** (continuando de RN-22, não de RN-26). Se `MULTIESCOLA.md` for aplicado depois, falta: adicionar `escolaId` a `Presente` (obrigatório, batendo entre remetente e destinatário), pré-filtrar a busca por escola e revalidar no backend antes de gravar (destinatário de outra escola → 404, não 403).

**Decisão de design central (RN-25), documentada no schema e no service**: presentear **não altera o saldo ACUMULADO** de nenhum dos dois — só o ATUAL. O acumulado é a métrica de prestígio de rankings/extratos; se o presente somasse nele, dois alunos poderiam se presentear de ida e volta pra sempre e inflar o acumulado sem mérito. Remetente: `saldoAtual -= 10` (igual a gastar num resgate/investimento — RN-04/RN-16). Destinatário: `saldoAtual += 10` (diferente de receber pontos de professor, que aí conta pro acumulado). Teste "round-trip" em `presentes.test.ts` prova que A↔B não muda o acumulado de ninguém.

`presenteService.ts`: `enviarPresente` faz débito condicional atômico (`updateMany where saldoAtual >= valor`) dentro de `prisma.$transaction` (RN-26/RN-02/RN-06), credita o destinatário, cria o `Presente` e **2 `Transacao`** (débito no remetente + crédito no destinatário) com `loteId = presente.id` — reaproveita o `agruparPorLote` do extrato e o `motivo` já traz o nome da outra pessoa ("Presente enviado para X" / "Presente recebido de Y"), então o extrato do aluno mostra tudo sem código de exibição novo. `statusPresenteSemana` calcula quanto já foi enviado na janela móvel de 7 dias corridos (RN-27, soma valores — não conta presentes — pra continuar correto se um valor ≠ 10 voltar) e quantos dias faltam pra reabrir; `GET /api/presentes` expõe isso pra `/presentear` e pro card do dashboard avisarem **antes** de o aluno tentar enviar.

UI: `/presentear` (aluno-only no `middleware.ts`, mesmo padrão de `/investir`) + card "Presentear um colega" no dashboard do aluno (não virou aba na bottom nav, de propósito). Migration `20260827111432_presentes`. `typecheck`/`lint`/`test`(46) limpos; integração em **85 testes** (15 novos em `tests/integration/presentes.test.ts` + `validarLimiteSemanalPresentes` em `regras.test.ts`).

## Continuação — Fase 11 (testes de integração dos CRUDs administrativos)

Item que ficava pendente desde a Fase 8 ("próximo passo sugerido"): `tests/integration/adminCrud.test.ts` (19 testes novos) cobre agora, contra Postgres real, os 5 CRUDs administrativos que só tinham verificação manual — Casas, Turmas (+ matrícula/remanejo de alunos), cadastro de professor (+ marcar PEC), cadastro de administrador (restrito ao super admin) e editar/excluir catálogo. Cobre em cada um: quem não é admin recebe 403; nome/e-mail duplicado é rejeitado; o caminho feliz funciona e persiste certinho no banco. Casos específicos: RN-10 (domínio) na criação de professor/admin; matricular um aluno já matriculado noutra turma o remaneja em vez de duplicar; excluir item de catálogo com resgate no histórico é bloqueado; super admin não pode remover a si mesmo.

Precisou de `SUPER_ADMIN_EMAIL` em `.env.test`/`.env.test.example`, batendo com o e-mail do usuário `admin` criado em `fixtures.ts`, já que `requireSuperAdmin()` falha fechado sem essa env var (ver Fase 8, achado "SUPER_ADMIN_EMAIL sem fallback").

Suíte de integração completa: 70 testes, todos passando. `typecheck`/`lint`/`test`(41) também limpos.

## Continuação — Fase 10 ("Ver a visão do aluno" para o admin)

Nova tela `/admin/visao-aluno`: admin escolhe um aluno num seletor e vê o que ele veria — saldo/posição no ranking, resumo e lista de investimentos (ativos + histórico), extrato completo, resgates do catálogo. **Somente leitura, de propósito**: nenhum botão de ação (investir, resgatar, etc.) — é uma tela de consulta pro admin entender o que o aluno está vendo, não um "login como" nem um jeito de agir em nome dele.

Implementado reaproveitando os endpoints que o próprio aluno usa, sem duplicar lógica de negócio: `GET /api/dashboard/rankings`, `GET /api/extrato` e `GET /api/investimentos` (esse já aceitava `?alunoId=` desde a Fase de investimentos) agora aceitam `?alunoId=` também nos dois primeiros — **só quando quem pede é admin**. RN-08 (privacidade do aluno) continua garantida nos três: professor ou aluno passando `?alunoId=` pro id de outra pessoa tem o parâmetro simplesmente ignorado (cai no próprio contexto/extrato deles, nunca no de terceiros) — coberto por teste de integração novo em `api-authorization.test.ts`. A página em si já fica fora do alcance de quem não é admin pelo middleware existente (`/admin/:path*`).

## Continuação — Fase 9 (doações: Dízimo e Lar do Idoso)

Aluno agora pode doar o próprio saldo pra **Dízimo (Igreja)** e **Lar do Idoso**, além das 6 opções já existentes em `/investir`. São tipos novos em `TipoInvestimento` (migration `20260826200455_doacoes_dizimo_lar_idoso`, `ALTER TYPE` no Postgres — aplicada em dev e teste, falta aplicar em produção via `npm run prisma:deploy` no próximo deploy).

Conceitualmente são **diferentes de Casa/turma**, mesmo sendo irreversíveis como elas: investir em Casa/turma credita um placar coletivo *dentro do sistema* (RN-16); doar pro Dízimo/Lar do Idoso só debita o aluno e gera 1 `Transacao` de auditoria — não existe "Casa" ou "turma" representando a igreja ou o lar do idoso pra creditar. `regras.ts` ganhou esse distinguo explícito: `ehInvestimentoColetivo` (casa/turma, credita algo) vs `ehDoacao` (dízimo/lar_idoso, só sai) — `ehInvestimentoIrreversivel` continua cobrindo os dois grupos (nenhum dos dois pode ser resgatado). `investmentService.ts::investirDoacao` é a nova função (mesmo padrão de débito atômico condicional das outras rotas de investimento, ver Fase 8).

UI: os dois aparecem na grade de opções de `/investir` com o badge "Sem volta" (igual Casa/turma); um flag `doacao: true` na opção troca o verbo da interface de "investir" pra "doar" ("Quanto doar para...", "Doar (irreversível)", "Sim, doar") — mesmo fluxo de confirmação, só a palavra muda pra soar natural. O card "Investir" do dashboard ganhou "· N já doados" quando o aluno já doou algo (`resumoInvestimentos` agora retorna `totalDoado` além dos campos existentes). `instrucoes-investimento.tsx` (conteúdo confessional, mesma ressalva de revisão pedagógica/religiosa já documentada) ganhou as duas opções na lista e uma frase a mais na virtude "Generosidade" citando a doação como o passo além do investir-mas-sem-esperar-nada-de-volta.

Coberto por `tests/unit/regras.test.ts` (classificação dos novos tipos) e `tests/integration/investmentService.test.ts` (débito, ausência de crédito coletivo, resumo agregado, RN-06 sem saldo suficiente).

## Continuação — Fase 8 (auditoria de segurança + correções)

Implementado e commitado nesta sessão, todo `typecheck`/`lint`/testes unitários limpos e verificado manualmente no navegador (`npm run dev`) — **sem testes de integração/E2E novos ainda** para os endpoints administrativos abaixo (RN-08/09/10 deles, ex.: todos exigem admin, não têm cobertura automatizada, só verificação manual; a suíte existente continua passando):

1. **Tema verde (era dourado)** — `tailwind.config.ts` (tokens `gold`/`gold-gradient` agora têm valores verdes, nomes mantidos de propósito pra não precisar tocar em cada arquivo), `CoinIcon` (SVG), ícones do PWA regenerados, `theme_color` em `manifest.json`/`layout.tsx`, accent do checkbox em `/pontuar`. Login: fundo 100% branco, botão "Entrar com Google" com gradiente verde próprio (`src/app/(auth)/login/page.tsx`). Topo do app: `logo.png` no lugar do `CoinIcon` genérico (`top-header.tsx`).
2. **Modelo de planilha pra download** — `/admin/importar` ganhou links "Baixar modelo (.csv)" e "Baixar modelo (.xlsx)", arquivos estáticos em `public/templates/`, gerados por `scripts/generate-import-template.mjs` (`npm run template:generate`).
3. **CRUD de Casas** — admin cria e edita Casas (nome, cor primária/secundária, ativo/inativo) em `/admin/casas`. `POST /api/casas` e `PATCH /api/casas/:id`, ambos admin-only, com checagem de nome duplicado.
4. **CRUD de Turmas (Salas) + matrícula de alunos** — em `/admin/turmas`: criar/editar nome e série, ativar/desativar (`POST`/`PATCH /api/turmas/:id`; `GET /api/turmas?todas=true` admin-only inclui inativas, pra tela de gerenciamento poder reativá-las — sem o parâmetro continua só ativas, usado em `/pontuar`). Além disso, o admin agora também matricula (ou remaneja) e remove alunos de uma turma direto na tela, via `POST`/`DELETE /api/turmas/:id/alunos` — como `Matricula` só permite uma turma por aluno por ano letivo, adicionar um aluno já matriculado noutra turma o move para a nova.
5. **Cadastro individual de professor + marcar PEC** — `/admin/professores` ganhou um card "Novo professor" (nome, e-mail, chips pra marcar em quais turmas ele já entra como PEC no ano vigente). `POST /api/admin/professores`, valida domínio institucional (RN-10) e duplicidade, cria o vínculo `professor_pec_turmas` numa transação junto com o usuário.
6. **Cadastro individual de administrador** — nova tela `/admin/administradores` (link no hub `/admin`), mesmo padrão do cadastro de professor: `POST /api/admin/administradores`, valida domínio institucional e duplicidade.
7. **Editar e excluir itens do catálogo** — `/admin/catalogo` ganhou um formulário de edição completo por item (antes só dava pra ativar/desativar) e um botão de excluir. `DELETE /api/catalog/:id` só remove o item se ele nunca foi resgatado (verifica `Resgate.count`); se já tem resgates no histórico, bloqueia com 400 e pede pra desativar em vez de excluir — evita quebrar o histórico de resgates.

~~Próximo passo sugerido: adicionar testes de integração para os CRUDs administrativos~~ — feito na Fase 11 (`tests/integration/adminCrud.test.ts`).

## Continuação — Fase 8 (auditoria de segurança + correções)

Auditoria completa do sistema (75 arquivos, 27 rotas de API) em 2026-08-26. Três achados críticos foram **explorados de verdade** contra o servidor local (não só lidos no código) antes de corrigir, pra confirmar que eram reais e depois confirmar que a correção realmente fecha o buraco. Todos os 13 achados foram corrigidos ou resolvidos nesta sessão; `typecheck`/`lint`/`test`(40)/`test:integration`(44, 9 novos) limpos.

**Críticos — corrida de condição (race condition), o mesmo defeito em 4 lugares:**
Em `investmentService.ts::investir` (RN-06/15), `investmentService.ts::resgatarInvestimento` (RN-20), `redemptionService.ts::resolverResgate` (RN-06 + estoque) e `pointsService.ts::ajustarSaldoTurma` (débito), o saldo/status era conferido *fora* (ou lido-então-escrito *dentro*, o que sob o isolamento padrão do Postgres — Read Committed — não é atômico) da transação, e nunca reconferido no momento de escrever. Provado com 5 requisições concorrentes reais: um aluno com 13 moedas conseguiu ficar com saldo −52 investindo em Casa 5×; 5 moedas viraram 25 resgatando o mesmo investimento 5×; um resgate de 30 aprovado 5× cobrou 150 e deixou o estoque em −4. Corrigido trocando a leitura-então-escrita por uma escrita condicional atômica (`updateMany({ where: { ..., saldoAtual: { gte: valor } } })` / `where: { ..., status: "ativo"|"pendente" } }`, checando `count` antes de prosseguir) — o próprio banco arbitra quem chega primeiro, sem lock explícito. Reproduzido de novo depois da correção (mesmas 5 requisições concorrentes): só 1 sucesso, saldo/estoque sempre corretos. Testes em `tests/integration/concorrencia.test.ts`.

**Alto — sessão não revalidada contra o banco:** `requireSession()` (`src/lib/auth/server.ts`) confiava só no JWT, que carrega uma cópia de `papel`/`ativo` tirada no login e vale até 30 dias — "Remover administrador" (Fase 7) marcava `ativo: false` no banco mas a sessão já aberta continuava com poderes de admin até expirar ou a pessoa deslogar. Provado: desativei uma admin com sessão aberta, ela continuou criando Casas e lendo dados de alunos. Corrigido: `requireSession()` agora relê `ativo`/`papel` do banco a cada requisição (uma consulta extra, barata no volume de uma escola) e usa o papel atual, não o do token. Testado em `tests/integration/api-authorization.test.ts` (desativar/rebaixar em runtime e confirmar 401/403 na próxima chamada, sem relogar).

**Alto — dependência vulnerável:** `next` estava em `14.2.15`, com mais de 30 avisos de segurança publicados (incluindo bypass de autorização em middleware). Atualizado para `14.2.35` (última da linha 14.x — não é a migração pra 16.x, que quebra a API de rotas).

**Médio — importação confiava no `status` devolvido pelo cliente:** `POST /api/import/confirmar` recebia de volta o `status`/`usuarioExistenteId` que a pré-visualização calculou, sem reconferir — um payload forjado podia declarar `status: "ok"` pra um e-mail de domínio externo, ou apontar `usuarioExistenteId` pra sobrescrever a conta de outra pessoa. Corrigido: a rota agora só aceita os campos crus da planilha (`linhaImportacaoSchema`) e roda `validarLinhas()` de novo no servidor, ignorando qualquer status/id vindo do payload.

**Médio — estoque negativo sem corrida:** resolvido junto com a correção de `resolverResgate` acima (decremento de estoque também virou condicional a `quantidadeDisponivel > 0`).

**Médio — teto de 10 BosqueCoins do professor comum (RN-14) é por lote, sem limite acumulado:** avaliado e **mantido como está**, de propósito — decisão consciente, não um bug esquecido. Já era um pressuposto documentado (seção "Pressupostos assumidos" abaixo).

**Baixo — catálogo vazava escopo de turma pro aluno:** `GET /api/catalog?escopo=turma` era aceito de qualquer papel; um aluno podia ver (só leitura — solicitar continuava bloqueado pela RN-22) os itens de turma. Corrigido: o papel do usuário decide o escopo efetivo, o parâmetro de query só serve pra professor/PEC alternarem a própria visão.

**Baixo — agrupamento de lote no extrato colapsava transações não relacionadas:** `agruparPorLote` usava `destinoId` como chave pra transações sem `loteId` (ajustes, investimentos) — múltiplos ajustes na mesma turma, ou múltiplos investimentos do mesmo aluno, apareciam como um "lote" só. Corrigido pra usar o `id` da própria transação nesse caso.

**Baixo — corte de 500 no extrato do admin podia partir um lote ao meio:** o `take` agora busca um lote bruto maior (2000) e o corte real acontece depois de agrupar, em unidade de lote (300), com uma flag `truncado` no retorno pra UI avisar quando refinar os filtros.

**Baixo — `SUPER_ADMIN_EMAIL` tinha fallback embutido no código:** removido; sem a env var, `ehSuperAdmin` agora retorna `false` pra todo mundo (falha fechada) em vez de silenciosamente escolher um e-mail padrão.

**Baixo — sem rate limiting em nenhuma rota:** avaliado, não corrigido nesta sessão — exigiria um serviço externo (ex.: Upstash) ou um limiter que funcione de fato em ambiente serverless (instâncias não compartilham memória entre si, então um limiter in-process daria falsa sensação de proteção). Fica como próximo passo se/quando isso for adicionado à infra.

## Status (Sistema de Investimentos, INVESTIMENTOS.md)

Implementado por completo: schema (`Investimento`, `DestinoTipo.casa`), regras puras (`calcularValorComJuros`, RN-15..RN-21), `investmentService.ts`, rotas `/api/investimentos`, RN-22 (só o PEC inicia resgate de escopo turma), UI (`/investir`, dashboard do aluno sem ranking de turmas + card "Investir" + instruções com virtudes). RN-01 original (propagação automática) foi removida de `distribuirPontos` e marcada como substituída em toda a documentação — creditar um aluno agora só mexe no saldo pessoal dele.

Suíte completa verde após a mudança: 40 testes unitários (10 novos), 35 de integração (11 novos: `investmentService.test.ts` + 3 de RN-22), 14 E2E (2 novos: `investir.spec.ts`), `typecheck` e `lint` limpos.

**Bugs reais encontrados e corrigidos nesta feature:**
1. `confirmarInvestimento()` em `/investir` zerava `tipoSelecionado` no sucesso, o que desmontava o próprio `Card` que continha a mensagem de feedback — o aviso de sucesso/erro nunca aparecia na tela (achado pelo teste E2E, não pela verificação manual). Corrigido movendo o feedback pra fora do bloco condicional.
2. `GET /api/extrato`/filtro por `turmaId` não fixava `destinoTipo: "turma"` explicitamente (achado na Fase 5 do `CONTINUACAO.md`, não desta feature, mas relevante porque o mesmo padrão existia nas novas rotas de investimento — já nasceram corrigidas).

**⚠️ Ação pendente antes de publicar**: o conteúdo de `src/components/dashboard/instrucoes-investimento.tsx` (explicação das 6 opções + as 6 virtudes com referências bíblicas parafraseadas) é conteúdo formativo que representa a voz institucional do colégio — precisa ser revisado e aprovado pela coordenação pedagógica/religiosa antes de ir pra produção. Isso está documentado também num comentário no topo do próprio arquivo. Nada tecnicamente pendente nele, só a revisão de conteúdo/tom.

**Pressuposto assumido**: "investir na Casa" e "investir na turma" sempre miram a PRÓPRIA Casa/turma do aluno (resolvida no servidor a partir de `usuarios.casa_id` e da matrícula do ano vigente) — o aluno nunca escolhe livremente qual Casa/turma receber, o que evitaria um aluno inflar o placar de um grupo que não é o dele. Isso não foi dito explicitamente no `INVESTIMENTOS.md`, mas é a leitura mais segura e consistente com RN-08.

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
npm run test                 # vitest run (regras de negócio - RN-01..RN-22, sem banco)
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
      investir/                  # investimentos do aluno (INVESTIMENTOS.md)
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
tests/unit/regras.test.ts        # 40 testes cobrindo RN-01..RN-21 (regras puras)
```

## Arquitetura da camada de serviços (`src/lib/services`)

Separação deliberada entre **regras puras** e **I/O**, para permitir testar a lógica de negócio sem precisar de um banco de dados real:

- **`regras.ts`** — funções puras (entrada → saída, sem `await`, sem Prisma). Cobre os cálculos de RN-03, RN-04, RN-05, RN-06, RN-09, RN-12, RN-13, RN-14, RN-16..RN-20 e a ordenação de rankings. É o arquivo com testes unitários (`tests/unit/regras.test.ts`, 40 testes, todos passando).
- **`pointsService.ts`** — orquestra `regras.ts` + Prisma dentro de `prisma.$transaction` (RN-02, atomicidade). Contém `distribuirPontos` (individual em lote / turma toda — só credita o saldo pessoal, ver RN-01 substituída), `pontuarProfessor` (RN-12/13), `ajustarSaldoTurma` (RN-05).
- **`redemptionService.ts`** — `solicitarResgate` e `resolverResgate` (RN-04, RN-06, RN-22, controle de estoque).
- **`rankingService.ts`** — monta os rankings de Salas/Casas e o contexto pessoal do dashboard.
- **`importService.ts`** — parse (`xlsx`), validação linha a linha e confirmação da importação (seção 4.6).
- **`anoLetivoService.ts`** — encerramento do ano letivo (seção 5).
- **`investmentService.ts`** — `investir`/`resgatarInvestimento`/`listarInvestimentos`/`resumoInvestimentos` (RN-15..RN-21, ver INVESTIMENTOS.md).

## Regras de negócio (RN-01 a RN-28)

Todas implementadas e comentadas no código-fonte, no arquivo/função correspondente. Resumo de onde encontrar cada uma:

| Regra | Onde |
|---|---|
| RN-01 Propagação tripla | **SUBSTITUÍDA** pelo sistema de investimentos (ver "Continuação — Investimentos" abaixo e RN-15..RN-21). Creditar um aluno agora só mexe no saldo pessoal dele; `calcularPropagacaoCredito` em `regras.ts` só retorna o delta do aluno. |
| RN-02 Atomicidade | `prisma.$transaction` em `pointsService.ts`, `redemptionService.ts` e `investmentService.ts` |
| RN-03 Motivo obrigatório | `regras.ts::validarMotivo`, também `NOT NULL` implícito no schema (`motivo: string`) |
| RN-04 Resgate individual isolado | `regras.ts::calcularDebitoResgateIndividual`, `redemptionService.ts::resolverResgate` |
| RN-05 Ajustes de PEC | `regras.ts::calcularAjusteTurma`, `pointsService.ts::ajustarSaldoTurma` |
| RN-06 Saldo nunca negativo | `regras.ts::validarDebitoNaoNegativo`, checado na aprovação do resgate, no ajuste de débito e ao investir (RN-15) |
| RN-07 Auditoria imutável | Nenhuma rota de DELETE/UPDATE em `transacoes`/`resgates`/`investimentos` — só criação e transição de status |
| RN-08 Privacidade do aluno | `src/lib/auth/server.ts::garantirAcessoProprioOuAdmin` |
| RN-09 Escopo do PEC | `regras.ts::validarEscopoPec`, checado em `pointsService.ts::ehPecDaTurma` antes de ajustes/aprovações |
| RN-10 Domínio de e-mail | `src/lib/auth/options.ts::signIn` callback |
| RN-11 Escopo por ano letivo | Toda leitura de `turma_periodos`/`casa_periodos` recebe `anoLetivoId` explícito; nunca há soma cross-year |
| RN-12 Só admin pontua professor | `regras.ts::validarQuemPontuaProfessor` |
| RN-13 Professor fora dos rankings | `regras.ts::excluirProfessoresDoRanking`; `rankingService.ts` só lê `turma_periodos`/`casa_periodos`, que nunca recebem incremento de professor |
| RN-14 Limite de 10 por lote | `regras.ts::validarLimiteValorPorLote` |
| RN-15 Só o aluno decide investir | `investmentService.ts::investir` (ou admin, via `garantirAcessoProprioOuAdmin`); exige saldo suficiente (RN-06) |
| RN-16 Investimento em Casa/turma é irreversível | `regras.ts::ehInvestimentoIrreversivel`/`calcularDeltaInvestimentoColetivo`, `investmentService.ts::investirColetivo` — vira `Transacao` direto, sem `Investimento` |
| RN-17 Investimentos financeiros são reversíveis | `regras.ts::ehInvestimentoReversivel`, `investmentService.ts::investirReversivel`/`resgatarInvestimento` |
| RN-18 Taxa congelada no momento do investimento | `src/lib/config/taxasInvestimento.ts` (único lugar com os números — taxas **ao mês**, `TAXAS_MENSAIS`), `regras.ts::calcularValorComJuros` (converte a mensal para diária com mês de 30 dias e compõe dia a dia). Campo `Investimento.taxaMensal` (era `taxaAnual`). |
| RN-19 Resgate devolve principal + juros | `investmentService.ts::resgatarInvestimento` — principal não altera acumulado, juros somam nos dois |
| RN-20 Resgate único, por inteiro | `regras.ts::validarPodeResgatar` (bloqueia resgatar duas vezes ou tipo irreversível) |
| RN-21 Toda operação de investimento gera Transacao | `investmentService.ts` (debita aluno sempre; investir em Casa/turma também credita o coletivo; resgatar credita o aluno) |
| RN-22 Só o PEC inicia gasto do saldo da turma | `src/app/api/redemptions/route.ts::POST` — admin não solicita mais resgate de escopo turma (só aprova, que é camada separada) |
| RN-23 Só aluno presenteia outro aluno ativo | `presenteService.ts::enviarPresente` (remetente/destinatário `papel = 'aluno'`, destinatário `ativo`, remetente ≠ destinatário); rota `POST /api/presentes` é `requirePapel("aluno")`; remetente vem sempre da sessão, nunca do corpo (RN-08) |
| RN-24 Valor do presente é fixo em 10 | `regras.ts::VALOR_PRESENTE`; `enviarPresenteSchema` não tem campo `valor` — qualquer `valor` no corpo é ignorado, grava sempre 10 |
| RN-25 Presentear só move o saldo ATUAL, nunca o ACUMULADO | `presenteService.ts::enviarPresente` (comentário explica o porquê: fecha a brecha de dois alunos inflarem o acumulado se presenteando de ida e volta) — remetente `saldoAtual -= 10`, destinatário `saldoAtual += 10`, nenhum `saldoAcumulado` tocado |
| RN-26 Transferência instantânea, saldo suficiente dentro da transação | `presenteService.ts::enviarPresente` — sem status/aprovação; débito condicional atômico (`updateMany where saldoAtual >= valor`) dentro de `prisma.$transaction` (RN-02/RN-06) |
| RN-27 Limite semanal de 10 BosqueCoins enviados por remetente (janela móvel de 7 dias) | `regras.ts::validarLimiteSemanalPresentes` (soma valores, não conta presentes); `presenteService.ts::enviarPresente` re-soma dentro da transação; `statusPresenteSemana` + `GET /api/presentes` alimentam o aviso prévio na UI |
| RN-28 Carência de resgate por tipo de investimento reversível | `src/lib/config/taxasInvestimento.ts::CARENCIA_RESGATE_DIAS` (poupança 0, FII 7, Tesouro 15, CDB 30 — **não** congelada no investimento, diferente da taxa/RN-18); `regras.ts::validarCarenciaResgate`; `investmentService.ts::resgatarInvestimento` bloqueia antes do prazo, `listarInvestimentos` expõe `diasRestantesCarencia` pra UI (`/investir` desabilita "Resgatar" e mostra "Resgate em Nd") |

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
