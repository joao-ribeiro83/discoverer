# Políticas de Segurança

Saiba como definir políticas de segurança ao nível da linha (RLS) que filtram os dados por utilizador ou função.

## O Que É a Segurança ao Nível da Linha?

A **Segurança ao Nível da Linha (RLS)** filtra automaticamente os resultados das consultas com base no contexto do utilizador, sem exigir alterações aos mapas ou às consultas.

**Exemplo:** Um gestor de uma região de vendas vê apenas os dados da sua região, mesmo que todas as regiões estejam na mesma tabela.

## Como Funciona a RLS

1. **Uma política contém regras.** Cada regra aplica-se a uma **área de
   negócio** ou a uma **pasta** e tem um predicado SQL — um fragmento de
   cláusula WHERE como `REGION = 'EMEA'` ou
   `{alias}."SALES_REP_ID" = :current_user_id`.
2. **Uma política é atribuída** a utilizadores, a funções, ou a ambos.
3. **Quando uma consulta é executada,** o Neo identifica todas as pastas cujas
   linhas podem chegar ao resultado: os itens e as condições do mapa, as pastas
   que um cálculo lê e as pastas associadas por junções que filtram linhas. Uma
   regra de área de negócio aplica-se a cada uma dessas pastas que pertença à
   sua área (própria ou partilhada); uma regra de pasta aplica-se à sua pasta.
4. **Cada predicado aplicável é combinado com E lógico na cláusula WHERE,** cada
   um entre os seus próprios parênteses, pelo que um `OR` nas condições do mapa
   não lhe consegue escapar. Numa folha que resume vários conjuntos de linhas de
   detalhe, o predicado fica dentro de cada resumo, antes de qualquer soma.

Os predicados podem usar três vinculações, preenchidas a partir do utilizador
com sessão iniciada e nunca a partir do pedido: `:current_user_id`,
`:current_user_email` e `:current_user_role`. Uma regra de pasta pode escrever
`{alias}` para indicar a sua pasta dentro da consulta.

## A segurança ao nível da linha recusa por omissão

**Um utilizador a quem nenhuma política dá linhas de uma pasta não vê nada
dessa pasta.** A consulta é recusada com o nome da pasta, e nenhum SQL chega ao
Oracle:

> Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) "SALES"

Isto é **deliberadamente diferente do Discoverer**, e é o único ponto em que o
Neo quebra a compatibilidade de propósito (D-090). A segurança ao nível da linha
do Discoverer era uma condição obrigatória de pasta; uma pasta sem ela mostrava
todas as linhas a toda a gente. Reproduzir isso seria reproduzir uma
vulnerabilidade.

O que daí resulta:

- **Uma instalação nova não devolve nada** enquanto não existirem políticas,
  nem mesmo aos administradores. Para que um grupo veja todas as linhas de uma
  área de negócio, atribua-lhe uma política cuja regra se aplique a essa área
  com o predicado `1 = 1`.
- **Eliminar, desativar ou retirar a atribuição de uma política nunca abre o
  acesso.** Só pode retirar linhas.
- **Os administradores não estão isentos.** Contornam as permissões de área de
  negócio; não contornam a segurança ao nível da linha. Não existe nenhum
  contorno de administrador para auditar.
- **As listas de valores seguem a mesma regra.** Uma lista pendente sobre uma
  pasta para a qual não tem política também é recusada.

A definição é `ROW_LEVEL_FAIL_MODE`
([Configuração](../../deployment/configuration.md#row-level-security)). `OPEN`
recusa apenas uma pasta a que alguma política ativa já se aplica e executa
todas as outras sem filtro, como antes desta alteração. Use-o apenas enquanto
as políticas de uma instalação estão a ser escritas: em `OPEN`, desativar uma
política volta a alargar o acesso.

### Os administradores são a fronteira de confiança dos predicados

Um predicado é SQL em bruto, inserido em todas as consultas a que a sua pasta
chega. O Neo valida-o quando é guardado e, antes de cada execução, volta a
verificar que não consegue sair dos seus parênteses. Recusa:

- separadores de instruções (`;`) e comentários (`--`, `/* */`);
- tudo o que feche o parêntese que envolve o predicado, como `1=1) OR (1=1`,
  que devolveria todas as linhas;
- palavras-chave DDL, DML e PL/SQL, `UNION` / `INTERSECT` / `MINUS` /
  `EXCEPT`, e chamadas `DBMS_`, `UTL_`, `OWA_`, `HTP.` e `HTF.`;
- vinculações diferentes das três acima e texto que não seja analisável como
  uma condição.

Estas verificações travam erros e as formas de fuga conhecidas. **Não conseguem
distinguir uma regra errada de uma certa.** Quem pode editar políticas decide o
que cada utilizador vê, por isso trate a função de administrador de segurança
como trataria o acesso à base de dados.

## Criar Políticas de Segurança

### Passo 1: Adicionar Política

1. Painel de Administração → **Área de Negócio** → **Segurança**
2. Clique em **+ Criar Política**
3. Introduza:
   - **Nome** — Identificador da política (p. ex., "Vendas por Região")
   - **Descrição** — Explique o que a política impõe
   - **Tipo de Alvo** — FOLDER (aplica-se a todos os itens da pasta)
   - **Pasta Alvo** — Selecione a pasta a proteger
   - **Ativo** — Alterne para ativar/desativar

### Passo 2: Definir o Predicado

Introduza o **Predicado SQL** — um fragmento da cláusula WHERE anexado às consultas:

```sql
REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
              SYS_CONTEXT('dn_user_context', 'region'),
              REGION)
```

**Decomposição da expressão:**

- `SYS_CONTEXT('dn_user_context', 'region')` — Obtém o valor de contexto de região do utilizador
- `NVL2(...)` — Se o valor de contexto existir, utiliza-o; caso contrário, utiliza REGION (sem filtragem)
- Compara a coluna REGION da pasta com o contexto de região do utilizador

### Passo 3: Atribuir Contexto aos Utilizadores

Os utilizadores precisam de valores de contexto para que as políticas filtrem os dados.

1. Painel de Administração → **Utilizadores** → selecione o utilizador → **Contexto de Segurança**
2. Defina pares chave-valor de contexto:
   - **Chave:** `region` (corresponde ao predicado)
   - **Valor:** `EMEA` (a região deste utilizador)
3. Guarde

Agora, quando este utilizador executar uma consulta, o predicado utiliza o seu contexto de região.

## Valores de Contexto de Segurança

O contexto de segurança é um conjunto de pares chave-valor associados a cada utilizador:

| Chave | Valor | Finalidade |
|-----|-------|---------|
| `region` | EMEA, APAC, AMER | Gestor de região de vendas |
| `department` | SALES, HR, FINANCE | Dados delimitados por departamento |
| `cost_center` | CC-001, CC-002 | Filtragem por centro de custo |
| `employee_id` | EMP-12345 | Dados específicos do funcionário |

**Definir o contexto:**

1. Painel de Administração → **Utilizadores**
2. Clique no utilizador → **Editar**
3. Desloque-se até **Contexto de Segurança**
4. Clique em **+ Adicionar Contexto**
5. Introduza a chave e o valor
6. Guarde

Os utilizadores podem ter vários valores de contexto. Os predicados referenciam o valor de contexto a utilizar.

## Exemplos de Predicados

### Exemplo 1: Filtragem por Região de Vendas

**Pasta:** SALES_DATA
**Política:** Ver apenas as vendas da sua região

```sql
REGION = SYS_CONTEXT('dn_user_context', 'region')
```

**Configuração do Contexto:**
- Utilizador: john@example.com → region = 'EMEA'
- Utilizador: jane@example.com → region = 'AMER'

**Resultado:**
- O John vê: WHERE REGION = 'EMEA'
- A Jane vê: WHERE REGION = 'AMER'

### Exemplo 2: Acesso por Departamento

**Pasta:** EMPLOYEE_DATA
**Política:** Os funcionários veem apenas o seu departamento

```sql
DEPARTMENT = SYS_CONTEXT('dn_user_context', 'department')
```

### Exemplo 3: Acesso de Gestor

**Pasta:** PAYROLL
**Política:** Os gestores veem os dados dos seus subordinados

```sql
MANAGER_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
OR EMPLOYEE_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Isto permite que os gestores vejam os registos dos seus funcionários (correspondência de MANAGER_ID) e o seu próprio registo.

### Exemplo 4: Sem Filtragem para Administradores

**Pasta:** SENSITIVE_DATA
**Política:** Ignorar a filtragem para administradores

```sql
SYS_CONTEXT('dn_user_context', 'is_admin') = 'Y'
OR DATA_OWNER = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Os administradores têm o contexto `is_admin='Y'`; os restantes veem apenas os seus próprios registos.

## Testar Políticas

### Testar Como Utilizador

1. Termine a sessão (ou utilize um navegador em modo de navegação anónima)
2. Inicie sessão como utilizador de teste
3. Execute um mapa que utilize a pasta protegida
4. Verifique se os resultados estão corretamente filtrados

### Verificar o Predicado nos Registos

Os registos de auditoria mostram o SQL executado:

1. Painel de Administração → **Registo de Auditoria**
2. Filtre pela execução do mapa
3. Veja o SQL gerado com o predicado aplicado

## Desativar Políticas

### Desativar Temporariamente

1. Encontre a política → **Editar**
2. Desmarque **Ativo**
3. Guarde

A política deixa de se aplicar. Os seus utilizadores **não** recuperam linhas
sem filtro: uma pasta para a qual já não têm nenhuma política ativa é recusada,
como descrito em
[A segurança ao nível da linha recusa por omissão](#a-segurança-ao-nível-da-linha-recusa-por-omissão).
Só com `ROW_LEVEL_FAIL_MODE=OPEN` é que desativar ou eliminar uma política
alarga o acesso.

### Eliminar Permanentemente

1. Encontre a política → **Eliminar**
2. Confirme

A política, as suas regras e as suas atribuições são removidas. Tal como ao
desativar, isto retira linhas e nunca as devolve.

## Considerações de Desempenho

Os predicados de segurança são adicionados a todas as consultas nas pastas protegidas:

**Impacto:**
- Aumenta o tempo de execução (normalmente <10% para colunas bem indexadas)
- As colunas de contexto indexadas têm melhor desempenho
- Listas IN extensas (muitas regiões) tornam as consultas mais lentas

**Otimização:**
1. Indexe as colunas referenciadas nos predicados:
   ```sql
   CREATE INDEX idx_sales_region ON SALES_DATA(REGION);
   ```

2. Utilize predicados simples (igualdade) sempre que possível

3. Monitorize o desempenho das consultas com/sem RLS

## Auditoria de Segurança

Acompanhe as alterações às políticas de segurança:

1. Painel de Administração → **Registo de Auditoria**
2. Filtre por tipo de entidade: SECURITY_POLICY
3. Veja quem criou/modificou/eliminou políticas

## Redacção de credenciais no registo de auditoria

Todos os pedidos que alteram dados (`POST`, `PUT`, `PATCH`, `DELETE`) têm os
seus parâmetros, query string, corpo do pedido e corpo da resposta guardados em
`audit_log.details`. Alguns desses corpos transportam credenciais em texto
simples — a palavra-passe Oracle de uma fonte de dados chega à API em texto
simples e só é cifrada no servidor, e uma alteração de palavra-passe transporta
a nova palavra-passe.

### A regra

Antes de qualquer coisa ser guardada, qualquer chave cujo nome **contenha** uma
destas subcadeias, sem distinguir maiúsculas de minúsculas, a qualquer
profundidade, tem o seu valor substituído por `[REDACTED]`:

| Subcadeia | Apanha, entre outros |
|-----------|----------------------|
| `password` | `password`, `passwordEnc`, `newPassword`, `currentPassword`, `passwordHash` |
| `secret` | `secret`, `clientSecret`, `client_secret` |
| `token` | `token`, `apiToken`, `refreshToken`, `accessToken` |
| `credential` | `credential`, `dbCredential`, `credentials` |
| `apikey` | `apiKey`, `api_key` |
| `authorization` | `authorization` |

A regra é `isSensitiveKey` em `backend/src/plugins/audit.ts`. Os arrays e os
objectos aninhados são percorridos até uma profundidade de seis.

### Porquê subcadeia e não uma lista exacta

Antes era uma lista exacta de nomes de chaves, e uma lista exacta é a lista dos
nomes em que alguém se lembrou de pensar. Faltavam dois — `passwordEnc` e
`newPassword` — e **174 palavras-passe de fontes de dados Oracle e 5
palavras-passe de utilizadores foram escritas em `audit_log` em texto simples**.
Não cifradas; a cadeia de caracteres tal e qual.

Uma regra por subcadeia apanha todas as variantes com prefixo, com sufixo e em
camelCase da mesma palavra, sem ninguém ter de as enumerar. O texto simples
existente foi expurgado pela migração `0011_purge_audit_log_credentials`, que
redige os valores no lugar em vez de apagar linhas — um registo de auditoria
cujas linhas desaparecem é um registo de auditoria pior.

### O que a redacção não cobre

- **Valores, não chaves.** Uma palavra-passe colada num campo de *descrição* é
  guardada. O redactor faz a correspondência pelo nome do campo; não consegue
  reconhecer um segredo só de olhar para ele.
- **Texto de erro.** Uma mensagem de falha do Oracle ou do Postgres pode citar
  a palavra "password" ("password authentication failed"). São mensagens, não
  credenciais, e ficam intactas.

### Se adicionar um campo que transporte um segredo

Dê-lhe um nome que contenha uma das seis subcadeias. `apiToken` está coberto;
`apiPass` não está. Acrescentar um nome que não corresponda é acrescentar uma
fuga, e o hook de auditoria não tem forma de o avisar.

`backend/src/__tests__/audit-redaction.test.ts` fixa a regra.

## Acesso ao nível do objecto

Ler uma pasta, um item, uma junção ou uma hierarquia pelo seu id exige a mesma
permissão que listá-los. Um utilizador sem permissão numa área de negócio a que
o objecto pertence recebe `403 Forbidden`, não o objecto. Os administradores
contornam a verificação.

Uma pasta pertence à sua área de negócio proprietária e a todas as áreas com que
é partilhada; basta uma permissão em qualquer delas. Os itens e as junções seguem
a sua pasta. As hierarquias seguem a sua área de negócio.

`backend/src/__tests__/get-by-id-scoping.test.ts` analisa todos os ficheiros de
rotas e falha se uma rota `GET` com id não nomear nenhuma verificação de acesso.

As leituras ainda não são registadas na auditoria. Isso é a fase 6.4.

## SQL personalizado em pastas COMPLEX

O SQL de uma pasta COMPLEX é inserido em cada consulta que a lê, por isso é
verificado **na criação e na actualização** pela mesma função
(`assertValidFolderSql` em `folder.service.ts`). Tem de ser uma única instrução
`SELECT` ou `WITH`; DDL, DML, `EXEC`, `EXECUTE IMMEDIATE` e chamadas `DBMS_` são
recusados com `400`. Mudar o tipo de uma pasta para COMPLEX sem SQL também é
recusado.

## Melhores Práticas

1. **Comece de Forma Simples** — Comece com filtragem por uma única coluna (região, departamento)
2. **Documente as Políticas** — Explique a intenção e os requisitos de manutenção
3. **Teste Exaustivamente** — Verifique se cada utilizador vê apenas os dados adequados
4. **Monitorize o Desempenho** — Os predicados complexos podem afetar a velocidade das consultas
5. **Utilize Chaves Consistentes** — Mantenha os nomes das chaves de contexto consistentes (p. ex., sempre `region`, não `region_code`)
6. **Reveja Regularmente** — Audite as políticas trimestralmente para garantir que continuam adequadas

## Limitações

- **Atribuição Manual de Contexto** — O contexto dos utilizadores é atualmente definido manualmente (sem sincronização automática com LDAP na v0.1)
- **Sem RLS Temporal** — Ainda não existe filtragem baseada no tempo
- **As Políticas Combinam-se com E Lógico** — Quando várias das suas políticas se aplicam a uma pasta, só vê as linhas que todas permitem
- **Sem UPDATE/DELETE ao Nível da Linha** — A RLS só filtra consultas SELECT

## O Que Se Segue?

- **[Gestão de Utilizadores](user-management.md)** — Criar utilizadores e atribuir contexto
- **[Gestão de Metadados](metadata-management.md)** — Organizar pastas
- **[Registo de Auditoria](audit-logging.md)** — Rever eventos de segurança

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API - Segurança](../../api/endpoints.md#security)
