# Testes de integração

Cobrem os critérios de aceite que dependem de um Postgres real (RN-01/02/04/06/08/09/12/13/14, encerramento de ano letivo, importação de planilha) - ver `CLAUDE.md` para o restante do mapa de regras de negócio.

## Rodando

Precisa de um Postgres real e de um banco **dedicado a testes** (nunca aponte para o banco de dev/produção - `resetDb()` faz `TRUNCATE` de todas as tabelas antes de cada teste).

```bash
# 1. crie um banco de teste (uma vez só)
createdb bosquecoins_test   # ou: psql -U postgres -c "CREATE DATABASE bosquecoins_test;"

# 2. copie o exemplo e ajuste a connection string
cp .env.test.example .env.test

# 3. aplique as migrations nele
DATABASE_URL="<sua-url-de-teste>" npx prisma migrate deploy

# 4. rode
npm run test:integration
```

`tests/integration/setup.ts` recusa rodar (lança erro) se `DATABASE_URL` não contiver a palavra `test` - é a rede de segurança contra rodar `TRUNCATE` no banco errado.
