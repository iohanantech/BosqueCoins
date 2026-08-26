# BosqueCoins

Sistema de gamificação escolar: professores premiam alunos com BosqueCoins, que alimentam o ranking da turma (Salas) e da Casa (Copa das Casas), além do saldo pessoal vitalício do aluno. Veja `CLAUDE.md` para a arquitetura e decisões de implementação.

> **Custo zero**: todo o setup abaixo usa exclusivamente camadas gratuitas (Neon, Vercel/Netlify Hobby, Google OAuth "Interno", GitHub privado).

## 1. Pré-requisitos

- Node.js 20+
- Uma conta Google Workspace do colégio, com permissão para criar projetos no Google Cloud Console
- Uma conta [Neon](https://neon.tech) (Postgres gratuito, sem cartão de crédito)
- Uma conta [Vercel](https://vercel.com) ou [Netlify](https://netlify.com) (deploy gratuito)

## 2. Setup local

```bash
git clone <este-repositorio>
cd bosquecoins
cp .env.example .env
npm install        # roda `prisma generate` automaticamente (postinstall)
```

### 2.1 Banco de dados (Neon)

1. Crie um projeto em [neon.tech](https://neon.tech) — não precisa de cartão de crédito.
2. Copie a **connection string com pooling** (pgbouncer) para `DATABASE_URL` e a **connection string direta** para `DIRECT_URL` no `.env`.
3. Rode as migrations e o seed:
   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```
   O seed cria: 1 ano letivo ativo, 1 admin, 3 professores (um deles PEC), as 4 Casas oficiais, 3 turmas de tamanhos diferentes, ~20 alunos ficticios e ~8 itens de catálogo. Nenhum dado real de aluno é usado.

### 2.2 Login Google (OAuth)

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto (ou use um existente do Workspace do colégio).
2. Vá em **APIs & Services > OAuth consent screen** e configure o tipo do app como **"Interno" (Internal)** — isso restringe o login ao domínio do Workspace automaticamente e evita o processo de verificação do Google.
3. Em **APIs & Services > Credentials**, crie um **OAuth Client ID** do tipo "Web application".
4. Em "Authorized redirect URIs", adicione:
   - `http://localhost:3000/api/auth/callback/google` (para desenvolvimento local)
   - `https://<seu-dominio-de-producao>/api/auth/callback/google` (depois do deploy)
5. Copie o Client ID e o Client Secret para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`.
6. Gere um `NEXTAUTH_SECRET` com `openssl rand -base64 32`.

> Lembrete: o login só funciona para e-mails que já existem na tabela `usuarios` (pré-cadastro pelo admin, manual ou por planilha) — a restrição de domínio (`@bosquemananciais.org.br`) é validada no backend, nunca só pelo parâmetro `hd` do Google.

### 2.2.1 Login de desenvolvimento (sem Google) — só em dev

Testar os 4 papéis (admin, professor, PEC, aluno) sem configurar o Google OAuth real é possível com um provider extra, **desligado por padrão e que nunca deve ir para produção**:

1. No `.env`, defina `DEV_AUTH_ENABLED="true"` (só tem efeito quando `NODE_ENV !== "production"` — em produção o próprio código ignora essa variável).
2. Rode `npm run prisma:seed` para ter usuários de cada papel.
3. Na tela `/login`, um seletor amarelo "Login de desenvolvimento" aparece abaixo do botão do Google, listando os usuários cadastrados — escolha um para entrar direto, sem senha.
4. Esse provider (`CredentialsProvider` com id `"dev"`) só autentica e-mails que já existem em `usuarios` e passa pelas mesmas checagens de conta ativa/domínio do login real — não é um atalho para as regras de autorização (RN-08/RN-09/RN-12), só uma forma de obter uma sessão válida sem o Google.
5. **Para desativar**: apague `DEV_AUTH_ENABLED` do `.env` (ou deixe `"false"`). Em produção, defina `NODE_ENV=production` normalmente (padrão de qualquer deploy) — isso já desativa o provider independentemente do valor de `DEV_AUTH_ENABLED`.

### 2.3 Rodar

```bash
npm run dev
```

Acesse `http://localhost:3000` — você será redirecionado para `/login`.

## 3. Testes e qualidade

```bash
npm run typecheck
npm run lint
npm run test        # 30 testes cobrindo as regras de negocio RN-01..RN-14 (sem banco)
npm run test:integration  # testes contra Postgres real - ver tests/integration/README.md
npm run test:e2e          # Playwright E2E - ver tests/e2e/README.md
```

## 4. Deploy gratuito (produção)

### 4.1 Vercel (recomendado) ou Netlify

- **Vercel**: importe o repositório GitHub privado, configure as variáveis de ambiente (as mesmas do `.env`, trocando `NEXTAUTH_URL` pela URL de produção), e faça o deploy. O plano Hobby é gratuito, mas é destinado a projetos não-comerciais — um sistema interno de colégio geralmente se enquadra; se tiver dúvida sobre o seu caso, considere Netlify, Render ou Cloudflare Pages como alternativa igualmente gratuita.
- Domínio `*.vercel.app` (ou equivalente) é suficiente — não é necessário comprar domínio próprio.

### 4.2 Checklist de variáveis de ambiente em produção

- [ ] `DATABASE_URL` e `DIRECT_URL` apontando para o projeto Neon
- [ ] `NEXTAUTH_SECRET` (diferente do usado em dev)
- [ ] `NEXTAUTH_URL` = URL pública de produção
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- [ ] `ALLOWED_EMAIL_DOMAIN` = `bosquemananciais.org.br`
- [ ] Redirect URI de produção adicionado nas credenciais OAuth do Google Cloud Console

### 4.3 Após o primeiro deploy

```bash
npm run prisma:deploy   # aplica migrations em producao (nao usa prisma migrate dev)
npm run prisma:seed     # opcional - so se quiser dados de exemplo em producao tambem
```

Depois, cadastre o admin real (e os professores) diretamente no banco (via Prisma Studio, `npm run prisma:studio`) ou pela planilha de importação (`/admin/importar`, mas ela é feita para alunos — o primeiro admin precisa ser criado manualmente).

## 5. Free tiers usados e seus limites

| Serviço | Camada gratuita | Limite relevante |
|---|---|---|
| Neon (Postgres) | Free tier | ~0.5 GB de armazenamento, não hiberna destrutivamente (ao contrário do Supabase free, que pausa após ~1 semana sem uso — importante para o uso sazonal de um colégio, com férias) |
| Vercel | Hobby | Builds e bandwidth generosos para um app deste porte; destinado a uso não-comercial |
| Google Cloud OAuth | Gratuito | Sem limite relevante para o volume de um colégio; modo "Interno" evita verificação do Google |
| GitHub | Privado (gratuito) | Necessário por lidar com dados de menores de idade (LGPD) |
| GitHub Actions (CI, opcional) | Free tier | Minutos mensais suficientes para lint/typecheck/test de um repo deste tamanho |

**Nenhum cartão de crédito é necessário em nenhuma etapa deste setup.**

## 6. Estrutura do repositório

Veja `CLAUDE.md` para a árvore de pastas completa, a arquitetura da camada de serviços, e onde cada regra de negócio (RN-01 a RN-14) está implementada.

## 7. Limitação conhecida deste scaffold

Este projeto foi gerado num ambiente sem acesso de rede ao registry de engines do Prisma (`binaries.prisma.sh`), então o `prisma generate` nunca rodou durante a construção — o código foi escrito à mão contra o schema, mas não foi verificado pelo compilador TypeScript com os tipos reais gerados pelo Prisma. **O primeiro passo depois de clonar deve ser `npm install` seguido de `npm run typecheck`**, para pegar qualquer divergência de tipo antes de seguir. A suíte de testes de regras de negócio (`npm run test`) já roda e passa independentemente disso, pois não depende do Prisma.
