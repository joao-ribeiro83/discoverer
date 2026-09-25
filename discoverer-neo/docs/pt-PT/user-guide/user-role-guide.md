# Discoverer Neo — Guia para a Função USER

Este guia destina-se a quem tem uma conta com a função **USER**. Explica o que
pode fazer, onde encontrar cada funcionalidade e o que deve pedir ao seu
administrador.

O Discoverer Neo substitui o Oracle Discoverer. Os relatórios que conhecia como
**folhas** chamam-se **mapas** aqui. Um **livro** continua a ser um grupo de
folhas.

---

## 1. O que a função USER pode fazer

| Pode | Não pode |
|---------|-----------|
| Executar os mapas a que tem acesso | Criar ou alterar áreas de negócio, pastas, itens, junções ou origens de dados |
| Exportar resultados para Excel, CSV e PDF | Gerir utilizadores, segurança ou o registo de auditoria |
| Agendar mapas para execução automática | Executar a migração a partir do Oracle Discoverer |
| Criar e editar os seus próprios mapas (se o seu administrador o permitir) | Ver as execuções de outros utilizadores |
| Partilhar **os seus próprios** mapas com colegas | Partilhar um mapa que pertence a outra pessoa |
| Escolher o seu idioma e tema | |

O menu mostra apenas o que a sua função permite usar. Se não vir uma página que
um colega vê, é porque tem uma função diferente.

### De onde vem o seu acesso

A sua função é só metade da história. O seu administrador também lhe dá
**acesso a áreas de negócio** (grupos de dados relacionados). Pode abrir um
mapa de uma destas formas:

- **Foi você quem o criou.** Pode sempre executar, editar, exportar, agendar,
  partilhar e eliminar os seus próprios mapas.
- **Alguém o partilhou consigo.** O que pode fazer depende do nível de
  partilha (ver [secção 8](#8-partilhar-mapas)).
- **É público.** Todos os utilizadores podem abrir, executar e exportar um
  mapa público.
- **O seu administrador deu-lhe direitos de criação ou edição na respetiva
  área de negócio.** Pode então trabalhar com os mapas dessa área.

Se um mapa de que precisa não está na sua lista, peça ao seu administrador ou
ao proprietário do mapa.

---

## 2. Iniciar sessão

1. Abra o endereço do Discoverer Neo que o seu administrador lhe deu.
2. Introduza o seu **Email** e **Palavra-passe**.
3. Clique em **Iniciar sessão**.

### Primeiro início de sessão com uma palavra-passe temporária

Se a sua conta veio do Oracle Discoverer, o seu administrador dá-lhe uma
**palavra-passe temporária**. Tem 16 caracteres, por exemplo
`ufNnRksjgR7U%M6X`.

1. Inicie sessão com o seu email e a palavra-passe temporária.
2. Abre-se o ecrã **Alterar a palavra-passe**. Não pode ignorar este passo.
3. Introduza novamente a palavra-passe temporária e depois a nova palavra-passe
   duas vezes.
4. O painel abre-se. A palavra-passe temporária deixa de funcionar.

A sua nova palavra-passe tem de ter **pelo menos 12 caracteres**. Tem de ser
diferente da palavra-passe temporária.

> **Dica:** a palavra-passe temporária não tem `O` maiúsculo, nem zero, nem
> `l` minúsculo, nem um. Estes caracteres são fáceis de confundir, por isso não
> são utilizados.

Se perder a palavra-passe temporária, peça ao seu administrador para a
redefinir.

Para terminar sessão, clique no seu email no canto superior direito e depois em
**Terminar sessão**.

---

## 3. O ecrã

O menu à esquerda tem estes itens:

| Item do menu | Para que serve |
|-----------|---------------|
| **Painel** | Os seus números de relance e os seus mapas recentes |
| **Mapas** | Encontrar, abrir, executar e criar mapas |
| **Agendamentos** | Mapas que se executam automaticamente |
| **Execuções** | Todas as execuções que iniciou, e o seu resultado |
| **Exportações** | Ficheiros que exportou |
| **Definições** (em baixo) | Idioma e tema |

### Painel

- **Total de Mapas** — os mapas que pode ver.
- **Total de Execuções** — quantas vezes executou um mapa.
- **Mapas Agendados** — quantos dos seus agendamentos estão ativos.
- **Resultados Agendados** — quantos resultados os seus agendamentos
  produziram.
- **Mapas Recentes** — os últimos 5 mapas que alterou.

---

## 4. Encontrar um mapa

1. Clique em **Mapas**.
2. Escolha um separador:
   - **Meus** — mapas que criou.
   - **Partilhado comigo** — mapas que outras pessoas partilharam consigo.
   - **Todos** — todos os mapas que tem permissão para ver. Isto inclui mapas
     que vieram do Oracle Discoverer.
3. Procure por nome, filtre por área de negócio ou ordene por nome ou por
   data.

### Procurar por livro

O painel **Pastas de trabalho** agrupa os mapas tal como o Discoverer os
guardou. Clique num livro para ver as suas folhas pela ordem original. Clique
numa folha para a abrir. Só vê as folhas que tem permissão para ver.

---

## 5. Executar um mapa

1. Abra o mapa.
2. Clique em **Executar**.

### Parâmetros

Muitos mapas pedem valores antes de serem executados, por exemplo uma data de
início e uma data de fim. Abre-se uma janela de **Parâmetros de execução**.

1. Preencha todos os campos com um `*` vermelho. Estes campos são
   obrigatórios.
2. Deixe um campo opcional vazio para usar a predefinição guardada.
3. Clique em **Executar**.

Se clicar em **Executar** e não parecer acontecer nada, procure esta janela. O
mapa aguarda que a preencha.

**Listas de valores.** A maioria dos campos mostra uma lista dos valores que
estão agora na base de dados. Clique no campo ou comece a escrever. Pode
sempre escrever qualquer valor. Se uma coluna tiver demasiados valores, o
campo indica
*"Demasiados valores para listar — escreva para pesquisar"*. Escreva dois ou
três caracteres para ver correspondências.

**Datas.** Escreva as datas no formato que o campo mostra.

### O que acontece depois de clicar em Executar

Uma execução passa por estas fases:

- **Em fila** — a execução aguarda a sua vez. As suas execuções vão uma de
  cada vez, por ordem.
- **Em execução** — a base de dados está a processá-la.
- **Concluída** — as linhas aparecem na tabela.

Se executar o mesmo mapa com os mesmos valores outra vez, e existir um
resultado válido, o Neo mostra logo esse resultado. Aparece marcado como
**Resultado reutilizado**. Clique em **Executar novamente** para obter dados
atuais.

Um resultado fica disponível durante **até um dia**. Depois disso, tem de
executar o mapa outra vez.

### Quando o botão Executar está cinzento

O motivo aparece por baixo do botão. **Sem colunas de saída** significa que o
mapa não tem colunas para mostrar. Abra o mapa no construtor e adicione uma
coluna.

Podem aparecer mais duas mensagens depois de clicar em **Executar**:

- **Sem autorização para executar** — pode abrir o mapa, mas não o pode
  executar sobre estes dados. Peça ao seu administrador.
- **Não foi possível ligar à origem de dados** — a base de dados não está
  disponível. Tente mais tarde. Se persistir, informe o seu administrador.

### Quando um mapa é recusado (painel âmbar)

Por vezes o Neo consegue construir a consulta mas não pode garantir que os
números estão corretos. Mostra então um **painel âmbar**, não um erro
vermelho. O painel diz-lhe o que pediu, porque é que o Neo não pode responder,
e o que mudar. O Oracle Discoverer recusava o mesmo tipo de consulta.

Isto não é uma falha. Altere o mapa como o painel indica, ou peça ao
proprietário do mapa que o altere.

---

## 6. Ler os resultados

### Quebras de grupo e totais

- **Quebras de grupo** — uma coluna agrupada mostra o seu valor uma vez, na
  primeira linha de cada grupo. O seu cabeçalho tem um emblema **Grupo**.
- **Subtotais** — uma linha no final de cada grupo, por exemplo
  `Total de EMEA`.
- **Totais gerais** — uma linha a negrito no final.

Os totais usam **todas as linhas que correspondem aos filtros**, não apenas as
linhas no ecrã.

**Quando ordena ou filtra a tabela, os grupos e os subtotais deixam de
aparecer.** A tabela passa a ser uma lista simples. Limpe a ordenação para
recuperar os grupos. Uma nota no fundo avisa quando isto acontece.

### Porque é que um total está vazio

Por vezes uma célula de total fica vazia de propósito. Isto acontece quando as
colunas vêm de conjuntos de linhas diferentes, e somá-las daria um número
errado. O Oracle Discoverer fazia o mesmo. As linhas na tabela estão corretas.
Só o total não é mostrado. A nota no fundo indica quantos totais estão vazios.

### Ordenar, procurar e colunas

- Clique no cabeçalho de uma coluna para ordenar: primeiro clique A → Z,
  segundo clique Z → A, terceiro clique remove a ordenação.
- Use a caixa de pesquisa para filtrar as linhas no ecrã. Isto não executa a
  consulta outra vez.
- Arraste o limite do cabeçalho de uma coluna para alterar a sua largura.

### Detalhar

Faça duplo clique numa linha para ver as linhas de detalhe por trás dela. Por
exemplo, faça duplo clique num total para ver as linhas que o compõem.

### Nota amarela acima dos resultados

Uma nota amarela lista as definições que esta execução não conseguiu aplicar,
por exemplo uma ordenação numa coluna que o relatório não mostra. As linhas
continuam corretas.

### Tabelas cruzadas

Os mapas vindos do Oracle Discoverer chegam como **tabelas**, mesmo quando o
original era uma tabela cruzada (uma tabela dinâmica). O Discoverer não
guardava que colunas ficavam no topo. Se puder editar o mapa, abra uma coluna
no construtor e defina a **Margem da tabela cruzada** como **No topo**.

---

## 7. Exportar resultados

1. Execute o mapa e aguarde até aparecer **Concluída**.
2. Clique em **Excel**, **CSV** ou **PDF**.
3. **Excel** e **CSV** transferem o ficheiro para o seu computador de
   imediato. **PDF** abre primeiro uma janela: escolha o papel e as colunas e
   clique em **Exportar**.
4. O ficheiro fica também na página **Exportações**. Pode transferi-lo de novo
   a partir daí.

| Formato | Utilize para |
|--------|-----------|
| **Excel** (.xlsx) | Relatórios e análise |
| **CSV** | Carregar os dados noutras ferramentas |
| **PDF** | Imprimir e enviar um esquema fixo |

Todos os formatos mantêm as quebras de grupo, os subtotais e os totais que vê
no ecrã.

Precisa da partilha **Pode exportar** (ou superior) para exportar um mapa que
pertence a outra pessoa.

### Porque é que faltam os botões de exportação

A exportação usa as linhas que uma execução já guardou. Não executa a consulta
outra vez. Os botões só aparecem quando a execução está **Concluída** e o seu
resultado ainda não expirou. Clique em **Executar novamente** para obter um
resultado novo que possa exportar.

### A página Exportações

Clique em **Exportações** para ver todas as suas exportações e o seu estado:
**Em fila**, **Em curso**, **Concluída** ou **Falhada**. Os ficheiros ficam
guardados durante **7 dias**. Depois são eliminados. Transfira os ficheiros
que quiser manter.

Pode sair da página enquanto uma exportação grande está em curso. Volte mais
tarde a **Exportações**.

---

## 8. Partilhar mapas

### Partilhar o seu próprio mapa

Só pode partilhar os mapas que **você criou**.

1. Abra o seu mapa.
2. Clique em **Partilhar**.
3. Escolha um colega.
4. Escolha o nível:

| Nível | O que o seu colega pode fazer |
|-------|---------------------------|
| **Pode ver** | Abrir e executar o mapa |
| **Pode exportar** | Abrir, executar, exportar e agendar o mapa |
| **Pode editar** | Tudo o que foi referido, e alterar o mapa |

5. Clique em **Partilhar**.

Para alterar um nível, escolha um novo na lista. Para deixar de partilhar,
clique em **Remover**. A alteração aplica-se de imediato.

Dê o nível mais baixo de que o seu colega precisa.

**Mapas públicos.** Se tornar um mapa **Público**, todos os utilizadores
podem abri-lo, executá-lo e exportá-lo.

### Mapas partilhados consigo

Abra **Mapas → Partilhado comigo**. O que pode fazer depende do nível que
recebeu. Uma partilha **Pode editar** permite-lhe alterar o mapa, mas
**não o pode partilhar** com outras pessoas. Só o proprietário o pode fazer.

Os seus próprios direitos de dados continuam a aplicar-se. Uma partilha dá-lhe
o mapa, não novos direitos de dados. Se vir **Sem autorização para executar**,
peça ao seu administrador acesso aos dados.

---

## 9. Criar e alterar mapas

Só pode criar um mapa numa área de negócio onde o seu administrador lhe deu o
direito de criar mapas. Se **Criar Mapa** der um erro, peça este direito.

### Criar um mapa

1. Clique em **Mapas**, depois em **Criar Mapa**.
2. Escolha uma área de negócio.
3. Introduza um **Nome**. Pode acrescentar uma **Descrição**.
4. Escolha um **Tipo de mapa**: **TABLE** (o habitual), **CROSSTAB** (tabela
   cruzada), **PAGE_DETAIL** ou **CHART**.
5. Adicione colunas: escolha itens na lista à esquerda. Arraste-os para
   alterar a ordem.
6. Adicione filtros (condições), parâmetros e campos calculados se precisar.
7. Clique em **Guardar**.

### Definições de coluna úteis

- **Ordem de ordenação** — 1, 2, 3 … para uma ordenação por mais do que uma
  coluna.
- **Agregação** — SUM, COUNT, AVG, MIN ou MAX. As outras colunas passam a ser
  os grupos.
- **Agrupar e quebrar** — mostrar um valor uma vez por grupo e acrescentar um
  subtotal.
- **Só na consulta, não mostrar** — a consulta usa a coluna, mas a tabela não
  a mostra.
- **Máscara de formato** — por exemplo `999,999.00` ou `DD-MON-YYYY`. Cada
  leitor vê o formato no seu próprio idioma.

### Parâmetros

Um parâmetro pede um valor quando o mapa é executado. O nome só pode ter
letras, dígitos e sublinhados, e tem de começar por uma letra, por exemplo
`start_date`.

### Formatação condicional

Depois de guardar o mapa, clique em **Formatação** para colorir células ou
linhas que correspondam a uma regra. As regras também se aplicam às
exportações.

### Copiar um mapa

Clique em **Duplicar** para fazer a sua própria cópia de um mapa. Para um mapa
que pertence a outra pessoa, precisa do direito de criar mapas na respetiva
área de negócio.

### Sem necessidade de rato

Cada ação de arrastar tem uma tecla equivalente. Use **Tab** para ir até um
item, e depois até ao seu botão **Adicionar**. Para mover uma coluna, vá até
à sua pega, prima **Space**, use as teclas de seta e depois prima **Space**
outra vez.

---

## 10. Agendar mapas

Um agendamento executa um mapa por si em horas definidas e guarda os
resultados.

Pode agendar os seus próprios mapas, e mapas partilhados consigo com o nível
**Pode exportar** ou superior.

### Criar um agendamento

1. Clique em **Agendamentos**, depois em **Novo Agendamento**.
2. Escolha o **Mapa**.
3. Introduza um **Nome**.
4. Escolha uma **Frequência**: **Diariamente (meia-noite)**, **Semanalmente
   (domingo, meia-noite)**, **Mensalmente (dia 1, meia-noite)** ou
   **Personalizado**.
5. Escolha o **Fuso horário**.
6. Opcional: defina **Válido a partir de** e **Válido até**.
7. Escolha o **Formato de Saída**: Excel ou CSV.
8. Se o mapa tiver parâmetros, preencha as **Predefinições de parâmetros**.
   Todas as execuções usam estes valores.
9. Marque **Ativado** e depois guarde.

### Frequência personalizada (cron)

**Personalizado** usa uma expressão cron com cinco partes:
`minuto hora dia-do-mês mês dia-da-semana`.

| Quando | Expressão |
|------|-----------|
| Todos os dias às 09:00 | `0 9 * * *` |
| De segunda a sexta às 08:00 | `0 8 * * MON-FRI` |
| Todas as segundas-feiras às 09:00 | `0 9 * * MON` |
| A cada 4 horas | `0 */4 * * *` |
| No primeiro dia de cada mês, à meia-noite | `0 0 1 * *` |

### Gerir agendamentos

Na lista de **Agendamentos**, cada agendamento tem estas ações: **Executar
agora**, **Pausar** ou **Ativar**, **Histórico**, **Editar** e **Eliminar**.

Clique em **Histórico** para ver cada execução, o seu estado, linhas e
duração. Clique em **Abrir** para ver as linhas, ou em **XLSX**, **CSV** ou
**PDF** para as transferir.

### Agendamentos vindos do Oracle Discoverer

Os agendamentos vindos do Oracle Discoverer chegam **desativados**. Não são
executados até alguém os ativar. Antes de ativar um, veja a coluna
**Planeador**:

| Planeador | Significado |
|---------|---------|
| **Não verificado** | Ainda sem verificação. Pode ativá-lo e ver o resultado. |
| `FLAT(...)` ou `REWRITE(...)` | O mapa pode ser executado corretamente. |
| `REFUSE(...)` | O mapa não consegue dar uma resposta correta. Cada execução falha. Corrija primeiro o mapa. |
| `UNPLANNABLE` | O mapa tem um problema de dados vindo da migração. Peça ao seu administrador. |

Uma execução agendada falhada não tenta novamente de forma automática.

---

## 11. A página Execuções

Clique em **Execuções** para ver todas as execuções que iniciou, em direto ou
agendadas. Vê o seu estado, linhas, duração e quando o resultado expira.

- **Abrir** — mostrar as linhas dessa execução.
- **Executar novamente** — executar com os mesmos valores.
- **Cancelar** — parar uma execução que ainda está em fila.
- **Eliminar** — remover uma execução terminada.
- **XLSX / CSV / PDF** — transferir as linhas guardadas.

Use o filtro **Mapa** para ver apenas as execuções de um mapa.

---

## 12. Definições

1. Clique em **Definições** no fundo do menu.
2. Escolha um **Idioma**: English, Português (Portugal), Français (France) ou
   Español (España).
3. Escolha um **Tema**: **Claro**, **Escuro** ou **Alto contraste**.
4. Clique em **Guardar**.

O ecrã muda de imediato para que possa experimentar cada opção. **Se não
clicar em Guardar, a alteração perde-se** quando recarregar a página.

As suas definições acompanham-no em qualquer computador e navegador.

---

## 13. Problemas e o que fazer

| Problema | O que fazer |
|---------|-----------|
| Não encontro um mapa | Procure em **Todos**. Se não estiver lá, peça ao proprietário para o partilhar, ou peça ao seu administrador acesso. |
| **Executar** não faz nada | Procure a janela **Parâmetros de execução** e preencha os campos com `*` vermelho. |
| **Sem autorização para executar** | Peça ao seu administrador acesso aos dados. |
| **Não foi possível ligar à origem de dados** | Aguarde e tente novamente. Se persistir, informe o seu administrador. |
| Painel âmbar | O mapa não consegue dar um número correto. Altere-o como o painel indica, ou peça ao proprietário. |
| Sem linhas | Verifique os filtros e os valores dos parâmetros. |
| A consulta demora demasiado tempo | Use intervalos de datas mais pequenos ou mais filtros. |
| Sem botões de exportação | O resultado expirou ou não está completo. Clique em **Executar novamente**. |
| Exportação **Falhada** | Exporte menos linhas (acrescente filtros), ou tente outro formato. |
| **Criar Mapa** ou **Duplicar** dá um erro | Peça ao seu administrador o direito de criar mapas nessa área de negócio. |
| Não consigo partilhar um mapa | Só pode partilhar mapas que criou. Peça ao proprietário. |
| O meu idioma ou tema voltou ao anterior | Não clicou em **Guardar** em **Definições**. |
| O agendamento não foi executado | Verifique se está **Ativado** e veja o seu valor de **Planeador**. |

### O que dizer ao seu administrador

Quando pedir ajuda, indique:

- o nome do mapa,
- o que clicou,
- a mensagem exata no ecrã,
- a data e a hora.
