# Criar Mapas

Saiba como criar mapas (consultas guardadas) utilizando o construtor interativo de mapas.

## O Que É um Mapa?

Um **Mapa** é uma definição de consulta guardada que especifica:
- Que colunas de dados (Itens) apresentar
- Que linhas filtrar (Condições)
- Como ordenar e agregar os resultados
- Parâmetros que tornam a consulta interativa
- Campos calculados para lógica de negócio

## Tipos de Mapa

O Discoverer Neo suporta quatro tipos de mapa:

| Tipo | Caso de Utilização |
|------|----------|
| **TABLE** | Apresentação de resultados em tabela, predefinição para a maioria das consultas |
| **CROSSTAB** | Vista de tabela cruzada (linhas × colunas) |
| **PAGE_DETAIL** | Esquema mestre-detalhe (detalhar) |
| **CHART** | Representações visuais (barras, linhas, circular, etc.) |

## Criar um Mapa

### Passo 1: Iniciar o Construtor de Mapas

1. Clique em **Mapas** na barra lateral, depois em **Criar Mapa**
2. Escolha uma área de negócio para o novo mapa
3. Introduza:
   - **Nome** — Título do mapa (obrigatório)
   - **Descrição** — Descrição opcional
   - **Tipo de Mapa** — Escolha TABLE, CROSSTAB, PAGE_DETAIL ou CHART
4. Clique em **Seguinte** ou **Criar**

### Passo 2: Selecionar Itens (Colunas)

Os itens são as colunas/campos que pretende apresentar.

1. No painel **Itens**, clique em **+ Adicionar Item**
2. Selecione a partir dos itens disponíveis na pasta
3. Reordene arrastando os itens
4. Para cada item, pode configurar:
   - **Nome de Apresentação** — Cabeçalho da coluna (assume por predefinição o nome do item)
   - **Direção de Ordenação** — ASC (ascendente) ou DESC (descendente)
   - **Ordem de Ordenação** — 1, 2, 3... para ordenação de várias colunas
   - **Função de Agregação** — SUM, COUNT, AVG, MIN, MAX (para itens numéricos)
   - **Largura de Apresentação** — Largura da coluna em píxeis (opcional)
   - **Máscara de Formato** — Formatação de data/número (opcional)

**Exemplo:** Para um relatório de Vendas:
- CUSTOMER_NAME (nome de apresentação: "Cliente", ordem de ordenação 1)
- AMOUNT (agregação: SUM)
- SALE_DATE (máscara de formato: "YYYY-MM-DD")

### Passo 3: Adicionar Condições (Filtros)

As condições filtram as linhas que surgem nos resultados.

1. Clique em **+ Adicionar Condição**
2. Selecione um **Item** pelo qual filtrar
3. Escolha um **Operador**:
   - `=` — Igual a
   - `<>` — Diferente de
   - `>` — Maior que
   - `<` — Menor que
   - `>=` — Maior ou igual a
   - `<=` — Menor ou igual a
   - `LIKE` — Correspondência de padrão (%)
   - `IN` — Vários valores
   - `BETWEEN` — Intervalo
   - `IS_NULL` — Sem valor
4. Introduza um **Valor** ou escolha um **Parâmetro**
5. Defina o **Operador Lógico** (AND/OR) se existirem várias condições

**Exemplo:** Mostrar apenas as vendas de 2026:
- Item: SALE_DATE
- Operador: >=
- Valor: 2026-01-01

**Condição Parametrizada:** Torne uma condição interativa associando-a a um **Parâmetro** (consulte o Passo 4).

### Passo 4: Adicionar Parâmetros

Os parâmetros tornam os mapas interativos, solicitando dados ao utilizador durante a execução.

1. Clique em **+ Adicionar Parâmetro**
2. Introduza:
   - **Nome** — Identificador único (apenas letras, dígitos e sublinhados, p. ex., `start_date`)
   - **Tipo** — STRING, NUMBER, DATE, LIST
   - **Valor Predefinido** — Predefinição opcional (utilizada se o parâmetro não for fornecido)
   - **Obrigatório** — Se estiver assinalado, o utilizador tem de fornecer um valor

3. Utilize o parâmetro numa condição selecionando-o em vez de um valor estático

**Exemplo:** Crie um parâmetro DATE `end_date` e utilize-o numa condição:
- Item: SALE_DATE
- Operador: <=
- Valor: <parameter: end_date>

Ao executar o mapa, será solicitado ao utilizador que introduza uma data de fim.

### Passo 5: Adicionar Campos Calculados (Opcional)

Os campos calculados criam novas colunas utilizando expressões SQL.

1. Clique em **+ Adicionar Campo Calculado**
2. Introduza:
   - **Nome** — Nome do campo (p. ex., `REVENUE_PERCENT`)
   - **Fórmula** — Expressão SQL (p. ex., `AMOUNT * QUANTITY`)

**Exemplo:**
- Nome: `MARGIN_PCT`
- Fórmula: `(AMOUNT - COST) / AMOUNT * 100`

As fórmulas podem referenciar:
- Nomes de itens (p. ex., `AMOUNT`, `QUANTITY`)
- Funções SQL (p. ex., `UPPER(CUSTOMER_NAME)`, `TRUNC(SALE_DATE)`)
- Funções de janela (p. ex., `SUM(AMOUNT) OVER (PARTITION BY CUSTOMER_ID)`)

### Passo 6: Guardar o Mapa

1. Clique em **Guardar Mapa**
2. Reveja o resumo
3. Clique em **Confirmar**

O mapa fica agora guardado e disponível na sua lista **Os Meus Mapas**.

## Editar um Mapa

1. Clique em **Mapas** → encontre o seu mapa → clique em **Editar**
2. Modifique itens, condições, parâmetros ou campos calculados
3. Clique em **Guardar**

## Sugestões para o Construtor de Mapas

### Consultas de Várias Pastas

Para consultar dados de várias pastas, tem primeiro de definir **Junções** entre elas. Contacte o administrador.

### Ordenação

- Defina a **Ordem de Ordenação** (1, 2, 3...) para ordenar por várias colunas
- Apenas os itens com uma ordem de ordenação surgem na ordenação
- As ordens de ordenação mais altas são aplicadas depois das mais baixas

### Agregação

Quando adiciona uma função de agregação (SUM, COUNT, etc.) a um item:
- Os resultados são automaticamente agrupados pelos itens não agregados
- Os itens agregados são calculados por grupo

**Exemplo:** Para obter o total de vendas por cliente:
- Adicione CUSTOMER_NAME (sem agregação, ordem de ordenação 1)
- Adicione AMOUNT (agregação: SUM)
- Resultado: Uma linha por cliente com o total de vendas

### Nomenclatura de Parâmetros

Os nomes dos parâmetros têm de:
- Começar por uma letra (A-Z, a-z)
- Conter apenas letras, dígitos e sublinhados
- Exemplos de bons nomes: `start_date`, `region_code`, `customer_id`

### Agrupar e Quebrar

Assinale **Agrupar e quebrar** numa coluna para ocultar os valores repetidos e
iniciar um novo subtotal sempre que ela mudar. As colunas de grupo são sempre
ordenadas antes de todas as outras — uma quebra só agrupa se nada ficar
ordenado fora dela.

### Colocação e Margem da Tabela Cruzada

A **Colocação** indica para que serve a coluna:

- **Agrupar por (eixo)** — uma coluna pela qual o relatório agrupa. Nunca é
  agregada, mesmo que o item de origem tenha uma agregação predefinida.
- **Medida** — um valor a agregar.
- **Item de página** — filtra a folha inteira; não é desenhada na grelha.

A **Margem da tabela cruzada** aplica-se a um mapa `CROSSTAB`: defina uma
coluna como *No topo* para cruzar o relatório. Os mapas migrados do Discoverer
não têm margem registada — o Discoverer não tinha esse campo — pelo que uma
tabela cruzada migrada é apresentada como tabela até a definir.

### Colunas Só de Consulta

Assinale **Só na consulta, não mostrar** para manter uma coluna fora dos
resultados enquanto a consulta continua a pedi-la. Use-o quando um filtro, uma
ordenação ou um total precisar de uma coluna que o leitor não deve ver.

### Formatos de Coluna

A **máscara de formato** usa a notação da Oracle (`999,999.00`, `$9,999.00`,
`DD-MON-YYYY`). É lida pelo seu significado — milhares agrupados, duas casas
decimais, dia-mês-ano — e depois apresentada na língua de cada leitor, para que
o mesmo mapa se leia corretamente para todos.

## O Que Se Segue?

- **[Executar Mapas](executing-maps.md)** — Execute o seu mapa e visualize os resultados
- **[Exportar Dados](exporting-data.md)** — Guarde os resultados em Excel ou CSV
- **[Partilhar Mapas](sharing.md)** — Partilhe com outros utilizadores

---

**Consulte Também:** [Guia do Utilizador](../user-guide/), [Guia do Administrador - Metadados](../admin-guide/metadata-management.md)
