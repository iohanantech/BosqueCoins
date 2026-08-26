# Testes E2E (Playwright)

Cobrem os fluxos críticos ponta a ponta (login por papel, pontuar, resgate, importação, encerramento de ano, 3 breakpoints) usando o [provider de login de desenvolvimento](../../README.md#221-login-de-desenvolvimento-sem-google--só-em-dev) - nunca o Google real.

## Rodando

Precisa de um Postgres real e de um banco **dedicado a E2E** (nunca o de dev/produção).

```bash
# 1. crie o banco (uma vez só)
psql -U postgres -c "CREATE DATABASE bosquecoins_e2e;"

# 2. aplique as migrations e semeie
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/bosquecoins_e2e?schema=public" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/bosquecoins_e2e?schema=public" npx tsx prisma/seed.ts

# 3. instale os browsers do Playwright (uma vez só)
npx playwright install chromium

# 4. rode
npm run test:e2e
```

`playwright.config.ts` já sobe o `next dev` na porta 3100 com `DEV_AUTH_ENABLED=true` e aponta `DATABASE_URL`/`DIRECT_URL` para `bosquecoins_e2e` automaticamente (via `webServer.env`) - não precisa exportar nada manualmente para rodar os testes, só ter o banco criado/semeado como acima.

**Importante**: `zz-ano-letivo.spec.ts` encerra o ano letivo ativo - por isso o nome começa com `zz` (roda por último, alfabeticamente). Se for adicionar um novo spec, não deixe ele depender de um ano letivo ativo específico rodar *depois* desse. Depois de rodar a suíte inteira uma vez, o banco `bosquecoins_e2e` fica com o ano letivo de 2026 encerrado - recrie-o (passos 1-2 acima) antes de rodar de novo, se precisar do estado original.
