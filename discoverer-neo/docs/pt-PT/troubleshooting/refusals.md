# Porque foi uma folha recusada

Uma **recusa** não é uma falha. É o planeador de consultas a dizer que consegue
construir o SQL, mas não consegue garantir que o número estaria certo — por
isso não o executa.

O Discoverer recusava as mesmas formas. Um número errado que parece certo é
pior do que nenhum número.

Uma recusa aparece como um painel **âmbar** com um título, um motivo e um passo
seguinte. Um painel vermelho é um erro verdadeiro e significa outra coisa; veja
[Executar Mapas](../user-guide/executing-maps.md).

A Fase 3.3 alargará esta página à medida que o planeador de consultas ganhar
novas verificações.

---

## Este total ainda não é fiável, por isso não foi executado

**Código:** `MULTI_FOLDER_AGGREGATE`

### O que foi pedido

A folha totaliza um valor — `SUM`, `AVG`, `COUNT`, `COUNT DISTINCT` — sobre
colunas que vêm de mais do que uma pasta.

### Porque não pode ser respondido

As pastas estão ligadas de um-para-muitos. Cada linha do lado "um" é repetida
uma vez por cada linha correspondente do lado "muitos". Somar depois dessa
junção conta o mesmo valor uma vez por cada repetição, por isso o total sai
demasiado alto.

Isto chama-se **fan trap** (armadilha de leque). O exemplo da própria Oracle
põe a inflação em duas a três vezes, em duas medidas ao mesmo tempo. Nada no
ecrã lhe diria que o número estava errado.

### O que mudar

- Totalize um valor de **apenas uma pasta**. Remova as colunas que vão buscar
  dados à segunda pasta, ou retire o total.
- Ou divida a folha em duas, uma por pasta.
- Ou mantenha as linhas de detalhe e totalize-as fora do produto.

Os totais entre pastas ficam disponíveis quando o planeador de fan-trap for
publicado (Fase 3.4). Nada na sua folha precisa de mudar para isso — a mesma
folha passará simplesmente a devolver um número correto.

---

## Estas pastas não estão ligadas, por isso a folha não foi executada

**Código:** `NO_JOIN_PATH`

### O que foi pedido

A folha usa colunas de duas ou mais pastas, e nenhuma cadeia de junções as liga
entre si.

### Porque não pode ser respondido

Sem uma junção, a base de dados não tem regra para emparelhar as linhas.
Combinaria cada linha de uma pasta com cada linha da outra — uma **junção
cruzada** — e devolveria um número de linhas igual ao produto das duas, sem
significado.

### O que mudar

- Remova as colunas da pasta não ligada. O painel indica as pastas envolvidas.
- Ou peça a um administrador para definir uma junção entre elas, em
  **Modelação de Dados → Junções**.

Um administrador pode verificar se a junção existe mas não foi migrada: algumas
junções do Discoverer não sobrevivem a uma importação do EUL se as suas pastas
não estavam ambas no âmbito.
