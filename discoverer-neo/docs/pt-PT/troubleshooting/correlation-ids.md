# Comunicar um erro: o id de correlação

Um erro genuíno (um painel **vermelho** — ver [Executar Mapas](../user-guide/executing-maps.md);
um painel âmbar de recusa é diferente, ver [Porque é que uma folha de trabalho foi recusada](refusals.md))
inclui agora um `correlationId` junto com a sua mensagem:

```json
{
  "error": "The query could not be completed.",
  "statusCode": 500,
  "kind": "QUERY",
  "correlationId": "8f14e45f-ceea-467e-a4d6-f8c9d1e2b3a4"
}
```

A mensagem apresentada é deliberadamente genérica — no caso de uma falha na execução de um mapa, nunca contém o texto de erro próprio da base de dados (uma mensagem `ORA-` do Oracle pode descrever pormenores internos do esquema ou dos dados que não devem chegar a todos os utilizadores que podem executar um mapa). O detalhe completo — o erro real do controlador, o SQL, a pilha de chamadas — é guardado do lado do servidor, identificado com o mesmo id.

**Ao comunicar um erro, inclua o `correlationId`.** Um administrador consegue localizar a linha de registo correspondente no servidor (ou, numa execução de mapa assíncrona, o próprio id da tarefa também serve de id de correlação) sem ser necessário repetir-lhe o texto original.

O campo `kind` agrupa o erro consoante o que falhou (`CONFIG`, `CONNECT`, `TIMEOUT`, `QUERY`, `CANCELLED`, `FORBIDDEN`) — útil para a triagem do suporte antes de abrir qualquer registo.
