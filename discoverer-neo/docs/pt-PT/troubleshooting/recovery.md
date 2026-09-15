# Recuperação da perda de dados

Procedimento completo: [deployment/backup.md](../deployment/backup.md). Esta
página é sintoma → o que restaurar, não a mecânica.

## Postgres está corrompido ou uma migração ruim destruiu dados

Restaure apenas a base de dados — o estado da fila de Redis não é afectado:

```bash
./scripts/restore.sh --postgres backups/postgres/discoverer_neo_<ts>.dump.gz \
                      --compose-file docker-compose.prod.yml
```

Escolha o despejo mais recente **antes** do evento de corrupção, não o despejo
mais recente em geral.

## Os trabalhos desapareceram após um travão Redis ou recriação de contentor

Se o Redis estava a executar a configuração prod (`--appendonly yes`), uma
reinicialização não planeada não deveria ter perdido nada — verifique
`docker compose -f docker-compose.prod.yml logs redis` para mensagens `AOF`
primeiro; uma restauração completa é um último recurso:

```bash
./scripts/restore.sh --redis backups/redis/data_<ts>.tar.gz \
                      --compose-file docker-compose.prod.yml
```

Isto substitui `/data` (RDB + AOF) completamente e reinicia o Redis — qualquer
coisa escrita após o timestamp do backup desapareceu. Se o ficheiro de composição
dev/base (`docker-compose.yml` sem sobreposição prod) é o que está em execução,
esta perda é esperada: esse ficheiro não activa o AOF.

## `importFromOracle` falhou a meio do caminho

Nada a restaurar. Desde BE-08, a pasta e seus itens são escritos numa transacção
— uma importação falhada não deixa pasta parcial para trás. Re-execute a
importação; a tentativa anterior falhada não deixou nenhum rastro para limpar.

## Verificação de uma restauração antes de confiar nela

Nunca assuma que um despejo é bom — prove-o:

```bash
./scripts/verify-restore.sh backups/postgres/discoverer_neo_<ts>.dump.gz
```

Restaura para uma base de dados descartável `<db>_restoretest`, diferencia
contagens de linhas versus a base de dados activa tabela por tabela, solta a
base de dados de scratch, e sai com código não-zero em qualquer incompatibilidade.
