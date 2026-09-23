# Execuções de Mapas, Retenção e o Limpador Automático

Saiba como as execuções de mapas são colocadas em fila, durante quanto tempo
os seus resultados são válidos, e como o limpador automático em segundo
plano os elimina.

## O Que É uma Execução de Mapa?

Cada execução de um mapa — um utilizador a clicar em **Executar**, e cada
execução agendada — passa por uma única fila em segundo plano (`map-runs`) e
guarda as suas linhas no Postgres. Nada consulta o Oracle duas vezes para o
mesmo mapa, utilizador e parâmetros enquanto já existir um resultado válido:
o segundo pedido devolve o resultado guardado de imediato, em vez de
executar a consulta outra vez.

Apenas a pré-visualização do próprio construtor de mapas
(`POST /api/maps/:id/execute`, limitada a 1000 linhas) passa ao lado da
fila — é uma verificação rápida e não guardada enquanto se compõe um mapa,
não uma execução.

## Ordem por Utilizador

As execuções do mesmo utilizador são executadas rigorosamente uma de cada
vez, pela ordem em que foram pedidas. As execuções de utilizadores
diferentes não são ordenadas entre si — o processo apenas executa a vez de
um utilizador e passa ao seguinte. `MAP_RUN_WORKER_CONCURRENCY` define
quantas execuções de utilizadores diferentes podem estar em curso ao mesmo
tempo.

## Retenção

| Tipo | O resultado mantém-se válido até |
|---|---|
| **Ao vivo** (um utilizador clicou em Executar) | conclusão + `MAP_RUN_LIVE_TTL_HOURS`, **limitado a 24 horas independentemente do que a definição disser** |
| **Agendada** | conclusão + a retenção própria desse agendamento, em dias (ver abaixo) |
| Qualquer execução falhada | conclusão + 24 horas — mantida como histórico, não como dados |
| Em fila ou em execução há mais tempo que `MAP_RUN_STALE_HOURS` | marcada como **Falhada** pelo limpador automático — uma rede de segurança após uma falha do processo |

Uma execução ao vivo nunca é utilizável por mais de um dia, seja qual for o
valor que um administrador definir em `MAP_RUN_LIVE_TTL_HOURS`. Este é um
limite rígido, não uma predefinição.

### Retenção Agendada (`BR_EXPIRY`)

A retenção de um agendamento vem do seu próprio campo
`result_retention_days` (predefinição de 30 dias; defina-o através de
`resultRetentionDays` em `POST`/`PUT /api/schedules` — ainda não existe um
campo no formulário de agendamento para isto). Os agendamentos importados de
um EUL legado do Discoverer trazem este valor automaticamente de
`EUL4_BATCH_REPORTS.BR_EXPIRY` — a coluna de retenção em dias que o próprio
Discoverer usava para os resultados de relatórios em lote (foram observados
os valores 1, 4, 10 e 30 em ambientes reais). Um `BR_EXPIRY` em falta é
importado como 30 dias, a mesma predefinição de um agendamento criado
diretamente no Neo.

## O Limpador Automático

O processo de execução de mapas também corre uma limpeza periódica, com o
mesmo padrão `setInterval` interno usado na limpeza de exportações:

- A cada `MAP_RUN_CLEANUP_INTERVAL_MINUTES`, elimina todas as execuções cujo
  `expires_at` já passou, incluindo em cascata os seus lotes de linhas
  guardados.
- Na mesma passagem, marca como falhada qualquer execução ainda **Em fila**
  ou **A executar** há mais de `MAP_RUN_STALE_HOURS` — isto só acontece se um
  processo tiver falhado a meio de uma execução e nunca tiver chegado a um
  estado final por si só.

Não existe um comando de limpeza manual. Para forçar uma limpeza mais cedo,
reinicie o backend (ou o processo autónomo) com um
`MAP_RUN_CLEANUP_INTERVAL_MINUTES` mais curto, ou elimine a execução a
partir da
[Página de Execuções](../user-guide/executing-maps.md#a-página-de-execuções)
/ `DELETE /api/runs/:id`.

## Configuração

| Variável | Predefinição | Descrição |
|---|---|---|
| `MAP_RUN_WORKER_ENABLED` | ativo em todos os ambientes exceto `test` | Executar o processo de execução de mapas neste processo |
| `MAP_RUN_WORKER_CONCURRENCY` | 3 (máx. 8) | Quantas execuções de utilizadores diferentes correm ao mesmo tempo |
| `MAP_RUN_LIVE_TTL_HOURS` | 24 | Validade de um resultado ao vivo — limitada a 24 independentemente deste valor |
| `MAP_RUN_MAX_ROWS` | 100000 | Linhas capturadas por execução antes de ser marcada como truncada |
| `MAP_RUN_BATCH_SIZE` | 1000 | Linhas por lote guardado (JSONB do Postgres) |
| `MAP_RUN_CLEANUP_INTERVAL_MINUTES` | 15 | Com que frequência o limpador automático corre |
| `MAP_RUN_STALE_HOURS` | 24 | Uma execução Em fila/A executar mais antiga do que isto é marcada como Falhada |

Consulte
[Configuração](../../deployment/configuration.md#map-runs-queue-retention-sweeper)
para saber como definir estas variáveis no `.env` ou nos ficheiros compose, e
[Implementação com Docker](../../deployment/docker.md) para executar o
processo de execução de mapas no seu próprio contentor.

## Monitorização

A profundidade da fila `map-runs` é exportada junto com os indicadores das
filas de exportações e do agendador — consulte
[Monitorização](../../deployment/monitoring.md).

## O Que Se Segue?

- **[Agendar Mapas](../user-guide/scheduling.md)** — como a execução de um agendamento é colocada em fila
- **[Origens de Dados](data-sources.md)** — a ligação Oracle contra a qual as execuções de mapas correm
- **[Configuração](../../deployment/configuration.md)** — a referência completa de variáveis de ambiente

---

**Consulte Também:** [Executar Mapas](../user-guide/executing-maps.md), [Guia do Administrador](../admin-guide/)
