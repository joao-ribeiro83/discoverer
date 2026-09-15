# Por que um cálculo foi recusado

Uma folha de trabalho pode ser executada enquanto um de seus cálculos não. Esta
página trata desse segundo tipo de recusa: uma única fórmula que veio de
Discoverer e não pôde ser compilada.

Para uma folha de trabalho inteira que não foi executada, ver
[Por que uma folha de trabalho foi recusada](refusals.md).

Um cálculo do Discoverer não foi armazenado como texto. Foi armazenado como uma
árvore de tokens numerados, e o Neo converte essa árvore em SQL. Quando a árvore
diz algo que o Neo não pode ler com confiança, o cálculo é **recusado com um
motivo** em vez de compilado para um equivalente aproximado.

Essa regra merece ser afirmada claramente, porque é a razão pela qual esta
lista existe:

> Um cálculo recusado é uma lacuna visível. Um compilado incorretamente é um
> número errado num relatório em que as pessoas confiaram por quinze anos.

As próprias ferramentas de migração do Discoverer adotaram a mesma posição.
`NOT IN` nunca foi compilado como `IN`, porque isso inverte o filtro e produz
um número que parece perfeitamente razoável mas está errado.

---

## Os motivos

Cada recusa carrega um destes. São enumerados por probabilidade decrescente.

### `UNFITTED_CODE`

**O que significa.** A fórmula usa uma função integrada do Discoverer cuja forma
exata não pôde ser estabelecida a partir das evidências.

O Neo não adivinhou como estes se renderizam. Cada função integrada que compila
foi ajustada contra 37 971 pares de fórmulas reais tirados de seus próprios
livros — a árvore de tokens armazenada junto com a cadeia que o próprio
Discoverer colocou na tela. Uma função que nunca apareceu num par que o Neo
pudesse ler é recusada em vez de ser presumida.

**Quais funções.** `CASE`, `WHEN`, `ELSE`, `IS NULL`, `IS NOT NULL`, `UPPER`,
`GREATEST` e a família analítica (`FIRST_VALUE`, `OVER`, `PARTITION`, `ORDER`,
`ROW_NUMBER`, `NPASSORDERCOMP`).

**O que fazer.** Reescreva o cálculo no editor de fórmulas do Neo. Um `CASE`
normalmente pode ser escrito com `DECODE`, que é compilado.

### `UNRESOLVED_FUNCTION`

**O que significa.** A fórmula chama uma função PL/SQL registada, e não existe
função correspondente no Neo.

**O que fazer.** Registe-a sob **Admin → Funções Personalizadas**, compatibilizando
com o nome que o Discoverer utilizou. Ver
[Funções Personalizadas](../admin-guide/custom-functions.md).

### `UNRESOLVED_ELEMENT`

**O que significa.** A fórmula refere-se a uma coluna ou parâmetro que o livro
já não contém. A referência sobreviveu; a coisa para a qual apontava, não.

**O que fazer.** Abra o cálculo e reoriente-o para uma coluna ativa. Este é
geralmente um livro do Discoverer que foi editado depois que a coluna foi
removida.

### `INVALID_IDENTIFIER`

**O que significa.** Um nome de coluna, nome de parâmetro ou nome de função que
chegou à fórmula não é um identificador Oracle válido.

O Neo recusa estes em vez de os colocar entre aspas para segurança. Um nome
contendo uma aspa, ponto e vírgula ou parêntese é um defeito de metadados ou
uma tentativa de injeção SQL, e colocá-lo entre aspas ocultaria ambos.

**O que fazer.** Corrija o nome em **Admin → Metadados**. Um nome de função
qualificado por pacote (`PKG.CALC`) também acaba aqui: registe um invólucro com
um único nome.

### `BAD_ARITY`

**O que significa.** O número de argumentos não corresponde a nada de que o Neo
tem evidência — para uma função integrada, qualquer forma vista no seu domínio;
para uma função registada, os **Parâmetros** que definiu para ela.

**O que fazer.** Para uma função registada, verifique que a sua lista de
parâmetros está correta. Para uma função integrada, a fórmula provavelmente está
danificada e deverá ser reescrita.

### `UNREAGGREGABLE`

**O que significa.** O cálculo contém uma agregação que não pode ser
corretamente re-totalizada entre uma junção — `AVG`, `COUNT DISTINCT`, `STDDEV`
ou `VARIANCE`.

O Neo reescreve algumas consultas para evitar contagem dupla. Estes quatro não
podem sobreviver a essa reescrita: uma média de médias não é a média.

**O que fazer.** Mova a agregação para a folha de trabalho, ou restrinja a folha
de trabalho a uma pasta para que nenhuma reescrita seja necessária. O mesmo
motivo numa folha de trabalho completa é coberto em [refusals.md](refusals.md).

### `DATE_WITH_TIME`

**O que significa.** Uma data armazenada contém uma hora, e o Neo não a descartará
silenciosamente.

As datas no Discoverer são armazenadas com seis dígitos finais para a hora.
Cada uma das 7 670 datas neste domínio as tem definidas para zero, portanto o
Neo compila a data e sabe que nada perdeu. Uma data que realmente contivesse
uma hora seria um valor diferente, e truncá-la alteraria um resultado
silenciosamente.

**O que fazer.** Informe isto. Isto não foi visto na prática e o Neo gostaria
de ver o livro.

### `UNKNOWN_SEMANTICS`

**O que significa.** O cálculo utiliza uma funcionalidade do Discoverer cujo
resultado não é visível no que o Discoverer mostrou, portanto não há nada de
que derivar o SQL.

Na prática isto é uma coisa: `2_Pass_Percentage`. O Discoverer mostrou-o apenas
como o seu argumento, portanto nada nas evidências diz o que realmente calculou.

**O que fazer.** Reescreva-o como um cálculo percentual explícito.

### `UNKNOWN_NODE`, `UNKNOWN_LITERAL_KIND`, `PARSE_FAILED`

**O que significa.** A fórmula armazenada não é algo que o Neo possa ler
absolutamente.

**O que fazer.** Informe com o nome do livro. Estes indicam ou uma funcionalidade
do Discoverer que ninguém encontrou ainda ou um livro danificado, e o Neo não
consegue diferenciar sem ver.

### `NOT_IN_ALLOWLIST`

**O que significa.** A fórmula geraria uma função SQL que não está na lista de
funções que o Neo emitirá.

**O que fazer.** Informe isto. Apenas um conjunto pequeno e fixo de funções
Oracle pode ser gerado, e chegar a este motivo significa que uma função
integrada foi mapeada para algo fora dele — que é um defeito no Neo, não nos
seus metadados.

### `CALCULATION_CYCLE`

**O que significa.** O cálculo refere-se a outro cálculo que se refere de volta
a ele, directamente ou através de uma cadeia. Não há valor a calcular.

O Discoverer permite que um cálculo use outro pelo nome, e o Neo substitui toda
a cadeia em vez do nome. Um ciclo não tem fundo, portanto é recusado com a
cadeia nomeada em vez de expandida até que algo quebre.

**O que fazer.** Abra o cálculo no editor de fórmulas do Neo e interrompa o
ciclo. A recusa nomeia cada cálculo no anel.

### `EXPANSION_TOO_DEEP`, `EXPANSION_TOO_LARGE`

**O que significa.** A cadeia de cálculos referindo-se a cálculos é mais longa
que 16 ligações, ou expande-se para mais de 20 000 nós.

O segundo é o que realmente acontece: uma cadeia que não é uma cadeia mas um
diamante, onde vários cálculos partilham um pai, multiplica em vez de somar.

**O que fazer.** Achate a cadeia. Um cálculo utilizado por vários outros pode
normalmente ser escrito uma vez como um item de pasta em seu lugar, que é
calculado uma vez em vez de substituído em todos os lugares.

### `NO_SOURCE_TOKENS`

**O que significa.** O Neo tem o texto legível da fórmula mas não a árvore de
tokens de que veio, portanto não há nada a compilar.

Isto **não** é uma lacuna no que o Neo compreende. Acontece quando o domínio foi
migrado por uma versão da ferramenta que não manteve a forma de tokens, e afeta
cada cálculo num tal domínio igualmente.

**O que fazer.** Re-importe os mapas. Isto escreve a forma de tokens junto a cada
fórmula e os cálculos compilam normalmente. Nada mais a altera.

### `TOKENS_NOT_RETAINED`

**O que significa.** A mesma situação que `NO_SOURCE_TOKENS`, informada pela
verificação anterior baseada em texto: a fórmula armazenada ainda visualmente
contém tokens estilo `[1,102]` e a árvore por trás deles não foi mantida.

**O que fazer.** Re-importe os mapas.

---

## O que uma recusa não significa

- **Não é um erro de dados.** Nada está errado com os seus dados.
- **Não oculta o original.** A forma de token do Discoverer armazenada é mantida
  junto à forma compilada, portanto um cálculo recusado hoje compila no dia em
  que a lacuna é fechada, sem re-executar a migração.
- **Não interrompe a folha de trabalho.** Outras colunas ainda se executam.

---

**Ver também:** [Por que uma folha de trabalho foi recusada](refusals.md),
[Funções Personalizadas](../admin-guide/custom-functions.md)
