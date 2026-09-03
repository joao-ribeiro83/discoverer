# Gestão de Metadados

Saiba como organizar e gerir a hierarquia de metadados: Áreas de Negócio, Pastas, Itens, Junções e Hierarquias.

## Hierarquia de Metadados

O Discoverer Neo organiza os dados através de uma hierarquia:

```
Business Area (e.g., "Sales")
└── Folder (e.g., "CUSTOMERS" table)
    ├── Item (e.g., "CUSTOMER_ID" column)
    ├── Item (e.g., "CUSTOMER_NAME" column)
    └── Item (e.g., "REGION" column)
```

## Áreas de Negócio

Uma **Área de Negócio** é um agrupamento lógico de dados e consultas relacionados. Exemplos: Vendas, Finanças, RH, Marketing.

### Criar Área de Negócio

1. Painel de Administração → **Áreas de Negócio**
2. Clique em **+ Criar Área de Negócio**
3. Introduza:
   - **Nome** — Nome único (obrigatório)
   - **Descrição** — Visão geral opcional
4. Clique em **Criar**

A área é criada mas está vazia. Adicione a seguir pastas e itens.

### Editar Área de Negócio

1. Clique na área de negócio
2. Modifique o **Nome** e a **Descrição**
3. Clique em **Guardar**

### Conceder Permissões

Os utilizadores precisam de acesso às áreas de negócio antes de as poderem utilizar. Consulte [Gestão de Utilizadores](user-management.md).

### Eliminar Área de Negócio

1. Clique em **Eliminar** (eliminação reversível)
2. Confirme

A área arquivada e todo o seu conteúdo permanecem na base de dados mas são marcados como inativos.

## Pastas

Uma **Pasta** representa uma tabela ou vista de uma origem de dados. As pastas contêm Itens (colunas).

### Criar Pasta (Manual)

1. Abra a Área de Negócio → separador **Pastas**
2. Clique em **+ Criar Pasta**
3. Introduza:
   - **Nome** — Nome da pasta (p. ex., "CUSTOMERS")
   - **Tipo de Pasta** — TABLE, VIEW, DERIVED, COMPLEX, JOIN ou SUMMARY
   - **Origem de Dados** — Selecione uma origem Oracle ou Postgres
   - **Esquema** — Esquema da base de dados (p. ex., "SALES")
   - **Nome da Tabela** — Nome da tabela na base de dados
   - **Descrição** — Notas opcionais
4. Clique em **Criar**

### Criar Pasta (Introspeção Oracle)

Importe automaticamente tabelas/vistas do Oracle:

1. Abra a Área de Negócio → separador **Pastas**
2. Clique em **Introspecionar** ou **+ Importar do Oracle**
3. Selecione:
   - **Origem de Dados** — Ligação Oracle
   - **Esquema** — Esquema a pesquisar
   - **Objetos** — Selecione tabelas/vistas (lista de caixas de verificação)
4. Clique em **Importar**

As pastas e os itens são criados automaticamente com os tipos e os mapeamentos de colunas adequados.

### Tipos de Pasta

| Tipo | Caso de Utilização |
|------|----------|
| **TABLE** | Tabela física da base de dados |
| **VIEW** | Vista da base de dados |
| **DERIVED** | Pasta personalizada baseada em SQL |
| **COMPLEX** | Pasta de várias tabelas com junções |
| **JOIN** | Resultado pré-associado de várias tabelas |
| **SUMMARY** | Tabela de resumo pré-agregada |

### Partilhar uma Pasta entre Áreas de Negócio

Uma pasta pertence a uma área de negócio **proprietária**, mas pode ser
*partilhada* com outras — tal como o Oracle Discoverer permite que uma pasta
apareça em várias áreas de negócio ao mesmo tempo. Uma dimensão de data ou de
organização partilhada é o caso habitual.

1. Painel de Administração → **Pastas**
2. Clique no ícone de **partilha** na linha da pasta
3. Escolha uma área de negócio em **Partilhar com** e clique em **Partilhar**

A pasta passa a aparecer em ambas as áreas. Em qualquer área que não seja a
proprietária, surge com um distintivo **Partilhada**, para que ninguém a edite
julgando que a alteração é local — as edições aplicam-se em todo o lado.

Para deixar de partilhar, abra o mesmo diálogo e remova o distintivo dessa área.
A área de negócio **proprietária** não pode ser removida; para mover uma pasta,
recrie-a no destino.

> **Migração do Discoverer:** todas as associações `BA_OBJ_LINKS` são
> preservadas. Uma pasta que pertencia a três áreas de negócio mantém as três —
> uma como proprietária e duas como partilhas.

### Editar Pasta

1. Clique na pasta → **Editar**
2. Modifique os metadados (nome, descrição, tipo)
3. Clique em **Guardar**

**Nota:** Alterar o nome da tabela/esquema após a criação pode quebrar mapas existentes. Proceda com cuidado.

### Eliminar Pasta

1. Clique na pasta → **Eliminar**
2. Confirme

Os mapas que utilizam esta pasta ficam quebrados. Os utilizadores veem erros ao executá-los.

## Itens

Um **Item** é uma coluna ou atributo de uma Pasta. Os itens são o que os utilizadores selecionam no construtor de mapas.

### Criar Item (Manual)

1. Abra a Pasta → separador **Itens**
2. Clique em **+ Adicionar Item**
3. Introduza:
   - **Nome** — Nome do item (p. ex., "CUSTOMER_ID")
   - **Tipo de Dados** — VARCHAR, NUMBER, DATE, CLOB, etc.
   - **Nome de Apresentação** — Etiqueta legível (assume por predefinição o nome)
   - **Nome da Coluna** — Coluna real da base de dados
   - **Descrição** — Texto de ajuda para os utilizadores
   - **Tipo** — ver a tabela abaixo. **CO** (Item de Base de Dados) é a escolha
     habitual: um item associado a uma coluna real. **CI** é um item *criado* —
     um cálculo.
   - **É Chave** — Caixa de verificação se se tratar de uma chave primária/estrangeira
   - **Está Oculto** — Caixa de verificação para excluir do construtor de mapas
   - **É Obrigatório** — Caixa de verificação se tiver de ser sempre incluído
4. Clique em **Criar**

### Criar Itens (A Partir do Oracle)

Ao introspecionar uma tabela, os itens são criados automaticamente para todas as colunas.

### Configurar a Apresentação do Item

Para cada item, defina:

- **Nome de Apresentação** — Como surge no construtor de mapas e nos resultados
- **Ordem de Apresentação** — Sequência na lista (os números mais baixos primeiro)
- **Máscara de Formato** — Formatação de número/data
  - Data: `YYYY-MM-DD`, `MM/DD/YYYY`, etc.
  - Número: `9,999.00`, `$9999`, etc.

### Editar Item

1. Clique no item → **Editar**
2. Modifique as propriedades
3. Clique em **Guardar**

### Ocultar/Mostrar Item

Alterne **Está Oculto** para excluir ou incluir no construtor de mapas. Útil para:
- Colunas internas que os utilizadores não devem selecionar
- Colunas reservadas para cálculos
- Campos descontinuados

### Eliminar Item

1. Clique no item → **Eliminar**
2. Confirme

Os mapas que selecionam este item ficam quebrados.

## Junções

Uma **Junção** define uma relação entre duas pastas.

### Criar Junção

1. Abra a Área de Negócio → separador **Junções**
2. Clique em **+ Criar Junção**
3. Introduza:
   - **Nome** — Nome da junção (p. ex., "Clientes para Encomendas")
   - **Pasta 1** — Pasta à esquerda
   - **Pasta 2** — Pasta à direita
   - **Tipo de Junção** — INNER, LEFT, RIGHT, FULL
   - **Condições** — Predicados da junção (ver abaixo)
4. Clique em **Criar**

### Condições da Junção

Cada junção tem uma ou mais condições que ligam colunas:

1. Clique em **+ Adicionar Condição**
2. Selecione:
   - **Item 1** — Coluna na Pasta 1
   - **Operador** — = (igual a)
   - **Item 2** — Coluna na Pasta 2
3. Adicione mais condições se necessário (encadeamento com AND)

**Exemplo:** Junção CUSTOMERS para ORDERS:
```
CUSTOMERS.CUSTOMER_ID = ORDERS.CUSTOMER_ID
```

### Tipos de Junção

| Tipo | Resultado |
|------|--------|
| **INNER** | Apenas as linhas correspondentes em ambas as pastas |
| **LEFT** | Todas as linhas da Pasta 1, com correspondência na Pasta 2 ou NULL |
| **RIGHT** | Todas as linhas da Pasta 2, com correspondência na Pasta 1 ou NULL |
| **FULL** | Todas as linhas de ambas as pastas (com NULLs) |

### Consultas de Várias Tabelas

Os utilizadores selecionam itens de várias pastas num mapa. O Discoverer Neo aplica automaticamente as junções necessárias.

**Exemplo:**
```
Map selects:
- CUSTOMERS.CUSTOMER_NAME (folder A)
- ORDERS.ORDER_DATE (folder B)
- ORDERS.AMOUNT (folder B)

Auto-applies: CUSTOMERS-to-ORDERS join
```

### Editar Junção

1. Clique na junção → **Editar**
2. Modifique o nome, o tipo ou as condições
3. Clique em **Guardar**

### Eliminar Junção

1. Clique na junção → **Eliminar**
2. Os mapas que selecionam de ambas as pastas deixam de poder ser executados

## Hierarquias

Uma **Hierarquia** permite a navegação por detalhamento em dimensões. Exemplo: Ano → Mês → Dia.

### Criar Hierarquia

1. Abra a Área de Negócio → separador **Hierarquias**
2. Clique em **+ Criar Hierarquia**
3. Introduza:
   - **Nome** — Nome da hierarquia (p. ex., "Tempo")
   - **Pasta** — Pasta que contém os itens da hierarquia
   - **Descrição** — Notas opcionais
4. Adicione níveis:
   - Clique em **+ Adicionar Nível**
   - Selecione o **Item** (tem de pertencer à pasta da hierarquia)
   - Introduza o **Nome do Nível** (p. ex., "Ano")
   - Defina o **Número do Nível** (1 = topo, 2 = segundo, etc.)
5. Clique em **Criar**

### Níveis da Hierarquia

Os níveis definem a ordem de detalhamento. Exemplo de hierarquia:

```
1. CALENDAR_YEAR (top level)
2. CALENDAR_QUARTER
3. CALENDAR_MONTH
4. CALENDAR_DATE (detail level)
```

Os utilizadores podem detalhar de ano → trimestre → mês → data nos relatórios.

### Editar Hierarquia

1. Clique na hierarquia → **Editar**
2. Modifique o nome, os níveis ou a ordem
3. Clique em **Guardar**

### Eliminar Hierarquia

1. Clique na hierarquia → **Eliminar**
2. O detalhamento fica indisponível para os mapas que utilizam esta hierarquia

## Cache de Metadados

Os metadados (áreas de negócio, pastas, itens, junções, hierarquias) são colocados em cache no Redis para melhorar o desempenho.

- **TTL da Cache:** 5 minutos (predefinição, configurável)
- **Invalidação:** Automática quando os metadados são modificados

Se modificar os metadados diretamente na base de dados (não recomendado), reinicie o backend para limpar a cache.

## Melhores Práticas

1. **Utilize Nomes Descritivos** — Evite abreviaturas; os utilizadores devem compreender a finalidade das colunas
2. **Forneça Descrições** — O texto de ajuda auxilia os utilizadores a criar consultas corretas
3. **Organize de Forma Lógica** — Agrupe itens relacionados em pastas e crie junções para relações comuns
4. **Oculte Colunas Desnecessárias** — Mantenha o construtor de mapas limpo; oculte itens internos/descontinuados
5. **Teste Após Alterações** — Verifique se os mapas existentes continuam a funcionar após edições aos metadados
6. **Documente as Hierarquias** — Descreva a lógica de detalhamento nas descrições
7. **Faça Cópia de Segurança Antes de Grandes Alterações** — Exporte as definições da área de negócio antes de uma reestruturação importante

## O Que Se Segue?

- **[Introspeção Oracle](oracle-introspection.md)** — Descubra automaticamente tabelas e colunas
- **[Origens de Dados](data-sources.md)** — Gerir ligações à base de dados
- **[Gestão de Utilizadores](user-management.md)** — Conceder acesso a áreas de negócio
- **[Políticas de Segurança](security.md)** — Definir segurança ao nível da linha

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API](../../api/endpoints.md)
