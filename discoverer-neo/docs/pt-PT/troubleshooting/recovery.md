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

## Um passo do cutover falhou

Procedimento completo: [`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md).
Cada passo tem seu próprio sinal de falha e reversão; os dois armadilhas gerais
encontradas durante o ensaio:

- **Um contentor falhado ainda pode mostrar `docker ps` como "em execução".** Sob
  `tsx watch` (inicialização estilo desenvolvimento), uma excepção não capturada ao iniciar — p.ex.
  a protecção de segredos de produção recusando um `JWT_SECRET` padrão — é capturada pelo
  observador, registada, e o processo fica esperando uma mudança de ficheiro que nunca virá.
  Verifique `docker logs` ou `/health`, não apenas o estado do contentor, para decidir
  se uma inicialização realmente funcionou.
- **`docker run -e SOME_PATH=/opt/...` no Windows/Git Bash** tem seu valor
  silenciosamente reescrito num caminho Windows pela conversão de caminhos do MSYS,
  quebrando qualquer coisa que espere um caminho Unix (p.ex. `ORACLE_CLIENT_PATH`).
  Prefixe o comando com `MSYS_NO_PATHCONV=1`.

Se o verificador (`docs/migration/verify.md`) reporta `COMPLETED_WITH_BLOCKERS`
no momento do cutover, verifique cada bloqueador contra a lista conhecida no
Passo 3 do runbook antes de o tratar como novo — um bloqueador Fase 3.4/4.x
já rastreado não é motivo para parar; um não listado é.
