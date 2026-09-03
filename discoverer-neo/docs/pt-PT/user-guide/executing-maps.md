# Executar Mapas

Saiba como executar mapas e visualizar os resultados.

## Executar um Mapa

### A Partir dos Seus Mapas

1. Clique em **Mapas** na barra lateral
2. Selecione um mapa em **Os Meus Mapas** ou **Partilhado Comigo**
3. Clique em **Executar**

### A Partir de uma Área de Negócio

1. Clique em **Áreas de Negócio** → selecione uma área
2. Encontre um mapa na secção **Mapas**
3. Clique em **Executar**

## Fornecer Parâmetros

Se o seu mapa tiver parâmetros, é apresentado um painel de introdução:

1. Introduza valores para cada parâmetro **Obrigatório**
2. Os parâmetros opcionais podem ficar em branco (é utilizado o valor predefinido)
3. Clique em **Executar** para iniciar

**Exemplo:**
```
Start Date: [2026-01-01]
End Date: [2026-12-31]
Region: [EMEA]
```

## Visualizar Resultados

Quando a execução termina, é apresentado:

### Tabela de Resultados

- **Colunas** — Com base nos itens selecionados no mapa
- **Linhas** — Filtradas e ordenadas de acordo com a definição do mapa
- **Paginação** — Se os resultados excederem o tamanho da página

### Informação de Resultados

- **Total de Linhas** — Número total de linhas que correspondem aos filtros
- **Tempo de Execução** — Duração da consulta
- **Executado Por** — O seu nome de utilizador
- **Executado Em** — Data/hora

## Quebras de Grupo e Totais

Um mapa migrado do Discoverer é apresentado como a folha original o desenhava.

**Quebras de grupo.** Uma coluna marcada como *agrupar e quebrar* é mostrada
uma vez por grupo: o valor aparece na primeira linha e fica em branco nas
linhas que o repetem. O cabeçalho da coluna tem o distintivo **Grupo**.

**Subtotais.** Quando o mapa os define, uma linha de subtotal fecha cada grupo,
com a etiqueta que o autor original escreveu — `Total de EMEA`.

**Totais gerais.** Uma linha a negrito no fim dos resultados.

Os totais são calculados sobre **todas as linhas que os filtros abrangem**, não
sobre as linhas atualmente carregadas. Carregar mais linhas não os altera.

**Ordenar ou filtrar a grelha suspende isto.** As quebras e os subtotais só
fazem sentido pela ordem em que a consulta devolveu as linhas. Se clicar num
cabeçalho para ordenar, os resultados passam a uma lista simples; limpe a
ordenação para recuperar a disposição. O rodapé indica quando está suspensa.

## Tabelas Cruzadas

Uma tabela cruzada coloca um conjunto de valores ao lado, outro no topo e as
medidas entre ambos.

Os mapas migrados do Discoverer chegam **como tabelas**, mesmo quando o
original era uma tabela cruzada. O Discoverer nunca registou que colunas
ficavam no topo, por isso nada o pode recuperar. Abra o mapa no construtor,
abra uma coluna e defina a *Margem da tabela cruzada* como *No topo* para
recuperar o cruzamento. Consulte
[Construir Mapas](building-maps.md).

## Paginação

Para conjuntos de resultados extensos:

- **Página Seguinte** — Carregar mais linhas
- **Carregar Mais** — Acrescentar linhas adicionais à vista atual
- Os resultados são carregados em páginas (predefinição: 100 linhas por página)

## Ordenar Resultados

Clique nos cabeçalhos das colunas para ordenar:
- **Primeiro clique** — Ordenar de forma ascendente (A → Z)
- **Segundo clique** — Ordenar de forma descendente (Z → A)
- **Terceiro clique** — Limpar a ordenação

**Nota:** A ordenação por várias colunas é definida no construtor de mapas, não aqui.

## Pesquisar Resultados

Utilize a caixa de pesquisa acima dos resultados para filtrar as linhas visíveis por palavra-chave:
- Pesquisa em todas as colunas
- Não distingue maiúsculas de minúsculas
- Filtragem em tempo real (não volta a executar a consulta)

## Ações de Coluna

Passe o cursor sobre os cabeçalhos das colunas para ver as opções:
- **Ocultar Coluna** — Ocultar temporariamente da vista
- **Ajustar Largura** — Arraste a margem da coluna para redimensionar
- **Copiar Valor** — Copiar o valor da célula para a área de transferência

## Transferir Resultados

Consulte [Exportar Dados](exporting-data.md).

## Execução Assíncrona (Consultas Longas)

Para consultas que demoram > 30 segundos:

1. Clique em **Executar em Segundo Plano**
2. Regressa ao painel
3. Consulte **Tarefas Agendadas** ou **Histórico de Execução** para ver o estado

Valores de estado:
- **PENDING** — Em fila, a aguardar execução
- **PROCESSING** — Em execução
- **COMPLETED** — Concluído, resultados disponíveis
- **FAILED** — A consulta falhou (consulte o erro)

Clique numa tarefa concluída para visualizar os resultados.

## Histórico de Execução

Visualize as execuções recentes de um mapa:

1. Abra um mapa → clique em **Histórico**
2. Veja a lista de execuções recentes com:
   - Data/hora de execução
   - Utilizador que a executou
   - Número de linhas devolvidas
   - Tempo de execução

Clique em qualquer linha para voltar a visualizar esses resultados.

## Resolução de Problemas

### Tempo Limite da Consulta

Se uma consulta demorar demasiado tempo:
- Verifique se os parâmetros são demasiado abrangentes (p. ex., sem filtro de data)
- Contacte o administrador para otimizar os dados subjacentes

### Sem Resultados

Se uma consulta devolver zero linhas:
- Verifique se as condições estão corretas
- Verifique os valores dos parâmetros
- Experimente executar sem os filtros opcionais

### Erro de Ligação

Se surgir "Falha na ligação":
- A origem de dados está temporariamente indisponível
- Tente novamente dentro de instantes
- Contacte o administrador se persistir

### Definições da Folha Que Não Foi Possível Aplicar

Uma nota amarela por cima dos resultados lista tudo o que o mapa pediu e esta
execução não conseguiu cumprir — um total cuja função do Discoverer não tem
equivalente em SQL, ou uma ordenação por uma coluna que o relatório não mostra.

As linhas em si estão corretas. Corrija a definição no construtor de mapas ou
consulte
[Resolução de Problemas da Migração](../migration/troubleshooting.md#worksheet-settings-that-could-not-be-applied).

## O Que Se Segue?

- **[Exportar Dados](exporting-data.md)** — Transfira resultados em Excel ou CSV
- **[Agendar Mapas](scheduling.md)** — Execute mapas automaticamente segundo um agendamento
- **[Partilhar Mapas](sharing.md)** — Partilhe consultas com colegas

---

**Consulte Também:** [Criar Mapas](building-maps.md), [Guia do Utilizador](../user-guide/)
