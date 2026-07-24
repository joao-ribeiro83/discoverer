# Introspeção Oracle

Descubra automaticamente tabelas e vistas de bases de dados Oracle e importe-as como pastas do Discoverer Neo.

## O Que É a Introspeção?

A **Introspeção** liga-se a uma base de dados Oracle e lê as definições de tabelas/vistas (esquema, colunas, tipos de dados) para criar automaticamente pastas e itens do Discoverer Neo.

Sem introspeção, teria de criar manualmente cada pasta e item, o que é moroso e propenso a erros em esquemas de grande dimensão.

## Processo de Introspeção

1. Ligar à base de dados Oracle (através de uma origem de dados)
2. Consultar as vistas do dicionário (USER_TABLES, USER_VIEWS, USER_TAB_COLUMNS)
3. Criar uma pasta para cada tabela/vista
4. Criar um item para cada coluna
5. Definir tipos de dados, restrições de chave e nomes de apresentação

## Executar a Introspeção

### Passo 1: Adicionar Origem de Dados

Primeiro, crie uma origem de dados Oracle (consulte [Origens de Dados](data-sources.md)):

1. Painel de Administração → **Origens de Dados**
2. Adicione uma ligação Oracle
3. Teste a conetividade
4. Guarde

### Passo 2: Introspecionar Tabelas

1. Painel de Administração → **Áreas de Negócio** → selecione a área
2. Clique no separador **Pastas**
3. Clique em **+ Introspecionar** ou **Importar do Oracle**
4. Selecione:
   - **Origem de Dados** — Ligação Oracle
   - **Esquema** — Esquema da base de dados (p. ex., "SALES")
5. Clique em **Listar Tabelas**

O sistema consulta todas as tabelas e vistas do esquema.

### Passo 3: Selecionar Tabelas/Vistas

Surge uma lista com todos os objetos detetáveis:

1. Assinale as caixas junto às tabelas/vistas que pretende importar
2. Desmarque as que pretende ignorar (p. ex., tabelas temporárias, objetos internos)
3. Clique em **Importar**

O Discoverer Neo cria pastas para cada objeto selecionado.

### Passo 4: Verificar a Importação

Após a conclusão da importação:

1. Atualize a lista **Pastas**
2. Verifique se todas as tabelas/vistas esperadas surgem
3. Clique numa pasta para rever os itens (colunas)
4. Verifique os tipos de dados e os nomes de apresentação

## Propriedades da Pasta Importada

Ao importar, cada pasta recebe:

| Propriedade | Detetado Automaticamente |
|----------|---------------|
| **Nome** | Nome da tabela/vista |
| **Tipo** | TABLE ou VIEW |
| **Esquema** | Esquema de origem |
| **Nome da Tabela** | Nome físico da tabela |
| **Descrição** | Nulo (o utilizador deve adicionar) |

## Propriedades do Item Importado

Para cada coluna, os itens recebem:

| Propriedade | Detetado Automaticamente |
|----------|---------------|
| **Nome** | Nome da coluna |
| **Tipo de Dados** | Tipo de dados Oracle (VARCHAR2 → VARCHAR, NUMBER, DATE, etc.) |
| **Nome de Apresentação** | Nome da coluna (o utilizador deve melhorar) |
| **Nome da Coluna** | Nome físico da coluna |
| **É Chave** | Sim, se a coluna fizer parte da chave primária |
| **Descrição** | Nulo (o utilizador deve adicionar) |

## Limpeza Após a Importação

Após a introspeção, melhore os metadados:

### Adicionar Descrições

1. Clique na pasta → **Editar**
2. Adicione uma **Descrição** que explique a tabela
3. Repita para os itens principais
4. Guarde

**Exemplo:**
- Pasta: "Tabela mestra de clientes com informações de contacto e endereço"
- Item CUSTOMER_ID: "Identificador único do cliente, chave primária"
- Item CUSTOMER_NAME: "Nome comercial do cliente"

### Melhorar os Nomes de Apresentação

1. Clique no item → **Editar**
2. Altere o **Nome de Apresentação** para uma versão legível
3. Exemplos:
   - CUST_ID → ID do Cliente
   - SALES_AMOUNT_USD → Montante de Vendas (USD)
   - CREATE_DT → Data de Criação

### Ocultar Itens Desnecessários

Para colunas internas que os utilizadores não devem usar:

1. Clique no item → **Editar**
2. Assinale **Está Oculto**
3. Guarde

Os itens ocultos não surgem no construtor de mapas mas continuam a existir para as consultas.

### Definir a Ordem de Ordenação

Organize os itens para o construtor de mapas:

1. Clique na pasta → **Editar**
2. Reordene os itens por **Ordem de Apresentação**
3. Guarde

## Gerir o Mapeamento de Tipos de Dados

Os tipos de dados Oracle são mapeados para tipos genéricos:

| Oracle | Mapeado Para | Notas |
|--------|-----------|-------|
| VARCHAR2(n) | VARCHAR | Texto, até 4000 carateres |
| CLOB | VARCHAR | Texto extenso (>4000 carateres) |
| NUMBER(p,s) | NUMBER | Numérico com precisão |
| DATE | DATE | Apenas data |
| TIMESTAMP | DATE | Data e hora |
| BLOB | VARCHAR | Binário (tratado como texto no Discoverer Neo) |

## Introspeção Incremental

Introspecione um esquema várias vezes para:

- Adicionar tabelas recém-criadas
- Voltar a importar tabelas alteradas
- Ignorar tabelas previamente importadas (o sistema verifica duplicados)

**Nota:** Voltar a importar uma tabela existente não atualiza as definições dos itens. Elimine primeiro a pasta antiga e depois introspecione.

## Gerir Objetos Complexos

### Vistas com Junções

As vistas que associam várias tabelas são introspecionadas normalmente. A pasta resultante não expõe a estrutura da junção; é apenas uma pasta com os itens do conjunto de resultados da vista.

### Gestão de Sinónimos

Os sinónimos da base de dados normalmente não são introspecionados (o sistema ignora-os). Se necessário:
- Crie uma vista em vez de um sinónimo
- Crie manualmente uma pasta a apontar para o nome do sinónimo

### Vistas Materializadas

As vistas materializadas do Oracle são introspecionadas como tabelas (estão materializadas, pelo que se comportam como tabelas).

## Resolução de Problemas de Introspeção

### "Nenhuma tabela encontrada"

**Causas:**
- Nome de esquema incorreto ou inexistente
- O utilizador não tem o privilégio SELECT_CATALOG_ROLE
- Não existem tabelas no esquema

**Solução:**
1. Verifique o nome do esquema junto do DBA Oracle
2. Verifique os privilégios do utilizador:
   ```sql
   SELECT * FROM SESSION_PRIVS WHERE PRIVILEGE LIKE '%CATALOG%';
   ```
3. Liste as tabelas disponíveis:
   ```sql
   SELECT OWNER, TABLE_NAME FROM DBA_TABLES ORDER BY OWNER;
   ```

### "Não é possível ligar ao Oracle"

Consulte [Origens de Dados - Resolução de Problemas](data-sources.md#resolução-de-problemas).

### "Tempo limite de importação"

**Causa:** Esquema de grande dimensão com muitos objetos

**Solução:**
- Introspecione esquemas mais pequenos separadamente
- Contacte o administrador para aumentar o tempo limite na configuração do backend

## Automação

Para automatizar a introspeção em grande escala (p. ex., após implementar um novo ERP):

1. Utilize a CLI ou a API da ferramenta de migração para criar pastas em lote
2. Escreva um script para introspecionar via API:
   ```bash
   curl -X POST http://localhost:3000/api/business-areas/:baId/folders/:folderId/introspect \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"dataSourceId":"...","schema":"SALES"}'
   ```

## Passos Seguintes

- **[Gestão de Metadados](metadata-management.md)** — Criar junções entre tabelas introspecionadas
- **[Origens de Dados](data-sources.md)** — Gerir ligações à base de dados
- **[Criar Mapas](../user-guide/building-maps.md)** — Utilizar tabelas importadas em consultas

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API](../../api/endpoints.md)
