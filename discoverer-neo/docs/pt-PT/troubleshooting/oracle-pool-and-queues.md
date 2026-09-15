# Leitura de esgotamento de conjunto Oracle e acumulação de fila

Os nomes de métrica abaixo estão documentados completamente em
[Monitorização](../deployment/monitoring.md#key-metrics).

## O conjunto Oracle "perdeu" ligações (BE-04)

Sintoma: as execuções de mapa contra uma fonte de dados começam a expirar com
`Timed out acquiring an Oracle connection after <N>ms`, mas
`oracle_pool_connections{state="in_use"}` nunca atinge
`oracle_pool_connections{state="max"}`.

Essa lacuna é o sinal. Um conjunto que está genuinamente ocupado mostra
`in_use` fixado em `max`; um conjunto que perdeu vagas (um erro na corrida de
tempo de aquisição de `getConnection` — ver BE-04, corrigido em
`backend/src/services/oracle-connection-pool.ts`) mostra `in_use` subindo para
algum número abaixo de `max` e ficando lá enquanto `waiting` cresce e
`oracle_pool_acquisition_timeouts_total` continua a subir. Apenas uma reinicialização
do processo recupera um conjunto que realmente perdeu vagas; se a correção
regredir, esse padrão de reinicialização-para-recuperação é o sinal para
verificar primeiro.

Leia os quatro em conjunto:

```promql
oracle_pool_connections{data_source_id="<id>", state="in_use"}
oracle_pool_connections{data_source_id="<id>", state="max"}
oracle_pool_connections{data_source_id="<id>", state="waiting"}
oracle_pool_acquisition_timeouts_total
```

`oracle_pool_acquisition_failures_total` e
`oracle_pool_acquisition_duration_avg_milliseconds` (por fonte de dados)
distinguem uma base de dados lenta (latência crescente, poucos falhos) de uma
mal configurada (falhos crescentes independentemente da latência).

## Acumulação de fila de exportação ou programador

`export_queue_jobs{state="waiting"}` ou `scheduler_queue_jobs{state="waiting"}`
permanecendo acima de dígitos simples durante mais do que alguns minutos significa
que os trabalhos estão a ser enfileirados mais rapidamente do que os workers os
drenam:

1. Verifique `export_jobs_total{outcome="failed"}` / `schedule_runs_total{outcome="failed"}`
   — uma taxa de falha crescente junto com a acumulação significa geralmente que
   os trabalhos estão a repetir (retrocesso exponencial de BullMQ) em vez de
   drenar, não que mais capacidade seja necessária.
2. Se os falhos são planos e `waiting` ainda cresce, dimensione a concorrência
   do worker (`EXPORT_WORKER_CONCURRENCY`) ou execute
   `workers/export.standalone.ts` / `scheduler.standalone.ts` no seu próprio
   contentor em vez de em-processo.
3. Ambas as métricas de profundidade de fila são lidas a cada 15s do próprio
   `getJobCounts()` de BullMQ dentro do processo do worker (`export.worker.ts`,
   `scheduler.worker.ts`) — uma métrica presa ao seu último valor enquanto os
   trabalhos estão visivelmente em execução significa que o próprio processo do
   worker está bloqueado, não que a fila esteja realmente inativa.

## Migração presa

`migration_running` preso a `1` com `migration_progress_percent` plano durante
mais do que o domínio normalmente leva: o trabalho de migração está preso, muito
provavelmente numa única leitura Oracle lenta. A etiqueta `phase` de
`migration_progress_percent` nomeia a tabela de destino (ou `read`/`plan`/`write`
para uma re-importação de mapas apenas) sobre a qual reportou progresso pela
última vez — verifique a contagem de linhas dessa tabela no esquema EUL de origem
para qualquer coisa inusitadamente grande.
