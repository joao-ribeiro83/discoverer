# O que um `/health` vermelho significa

`/health` (e `/api/health`) é uma verificação de **preparação**: informa se
esta instância de backend pode realmente servir tráfego, não apenas se o processo
Node está em execução. Ver [Monitorização](../deployment/monitoring.md) para a
divisão completa preparação vs vivacidade (`/live` é o ponto de vivacidade, e
não fica vermelho por nenhum destes).

Um `503` de `/health` significa que `database` ou `redis` no corpo da resposta
é `"disconnected"`:

```bash
curl http://localhost:3000/health
# {"status":"degraded","database":"disconnected","redis":"connected",...}
```

## `database: "disconnected"`

O backend não consegue executar `SELECT 1` contra Postgres. Por ordem de
probabilidade:

1. **O contentor Postgres está inativo ou ainda a iniciar.**
   `docker compose -f docker-compose.prod.yml ps postgres` — se não estiver
   `healthy`, verifique `docker compose -f docker-compose.prod.yml logs postgres`.
2. **`DATABASE_URL` está errado** (host/porta/credenciais erradas). Em
   `docker-compose.prod.yml` isto é construído a partir de `POSTGRES_USER` /
   `POSTGRES_PASSWORD` / `POSTGRES_DB` em `.env` — confirme que correspondem ao
   que Postgres foi realmente inicializado (alterar `POSTGRES_PASSWORD` depois do
   volume já existir não muda retroativamente a senha da própria base de dados).
3. **O conjunto de ligações está esgotado ou a consulta expirou.** Limitado por
   `DATABASE_POOL_CONNECTION_TIMEOUT_MS` (padrão 10s) — `/health` não ficará
   pendurado indefinidamente, mas levará até esse tempo para relatar vermelho.

Isto **não** causa pane no backend. Uma ligação inativa morta no conjunto é
capturada (`backend/src/db/index.ts`'s `pool.on('error', ...)`) e registada; o
conjunto substitui-a na próxima utilização. Se vir o contentor backend a
reiniciar repetidamente enquanto Postgres está inativo, isto é uma regressão
disto — verifique `docker inspect <container> --format '{{.RestartCount}}'` e
registos do contentor para um erro `pg-pool` não capturado.

## `redis: "disconnected"`

O `redis.ping()` do backend não foi bem-sucedido em 2 segundos. Mesma primeira
verificação — `docker compose -f docker-compose.prod.yml ps redis` — depois
confirme que `REDIS_URL` corresponde ao nome de anfitrião do serviço `redis`
(`redis://redis:6379` em composição prod; o cliente ioredis reconecta-se
automaticamente uma vez que Redis volta, portanto nenhuma reinicialização é
necessária aqui também).

O limite de 2 segundos é intencional: `ioredis` colocaria de outra forma em fila
e tentaria novamente um comando contra um servidor inativo durante dezenas de
segundos antes de rejeitar, o que converteu um `503` num `504` de nginx em seu
lugar — demasiado lento para um orquestrador ou balanceador de carga agir.

## O portão de versão Oracle recusou uma ligação

Um erro diferente, não um campo `/health`: `getConnection()` lança
`OraclePoolError: Oracle Database X.Y.Z is below the minimum supported version
12.1.0.0.0` quando o servidor de uma fonte de dados relata uma versão anterior
a 12.1. Isto é intencional (ver Decisão D-019) — o modo Oracle anterior a 12.1
usa um verificador de senha que o modo fino de `node-oracledb` não consegue
autenticar, e a falha precisa ser uma recusa clara nomeando ambas as versões,
não um erro de autenticação opaco três camadas mais abaixo. Correção: aponte a
fonte de dados para um servidor 12.1+, ou defina `ORACLE_THICK_MODE=true` e
reconstrua a imagem de backend (`INSTALL_ORACLE_CLIENT` segue
`ORACLE_THICK_MODE` automaticamente em `docker-compose.prod.yml`).

## `oracleClient: "thick_unavailable"`

Significa `ORACLE_THICK_MODE=true` mas o Cliente Instantâneo Oracle não conseguiu
carregar — isto faz com que todo o processo falhe na inicialização (`server.ts`
chama `process.exit(1)`), portanto não verá realmente este valor sobre HTTP;
está aqui para pesquisas de registos. Confirme que a imagem foi construída com o
cliente (ver a secção Implementação de Produção de
[docker.md](../deployment/docker.md)) — o registo de imagem de backend
`DPI-1047: Cannot locate a 64-bit Oracle Client library` quando falta.
