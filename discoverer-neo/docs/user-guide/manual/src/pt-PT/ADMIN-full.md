# A sua função num relance

É um **administrador**. Pode usar todas as páginas do Discoverer Neo. Configura os dados sobre os quais os mapas são construídos, decide quem vê o quê, cuida das contas de utilizador e traz o trabalho antigo do Oracle Discoverer.

Um **mapa** é um relatório (no Oracle Discoverer, era uma folha de cálculo). Um **livro** é um grupo de mapas. Uma **área de negócio** é um grupo de dados relacionados. Uma **pasta** é uma tabela ou vista dentro de uma área de negócio. Um **item** é uma coluna de uma pasta.

## Pode / Não pode

| Pode | Não pode |
|---|---|
| Abrir, executar, alterar, partilhar, copiar e eliminar todos os mapas | Eliminar ou desativar a sua própria conta |
| Construir mapas em qualquer área de negócio, sem permissão | Transferir a exportação de outro utilizador (as exportações são sempre privadas do respetivo proprietário) |
| Ver o SQL gerado e o plano da base de dados de um mapa | Ver os agendamentos de outro utilizador na lista **Agendamentos** (vê os seus) |
| Ver as execuções de todos os utilizadores (**Mostrar execuções de todos os utilizadores**) | |
| Criar, editar e desativar áreas de negócio, pastas, itens, junções, hierarquias, funções personalizadas e origens de dados | |
| Dar e retirar permissões de área de negócio | |
| Criar, editar, desativar, eliminar e reativar utilizadores | |
| Emitir um ficheiro de credenciais com palavras-passe temporárias | |
| Passar um mapa para um novo proprietário | |
| Escrever políticas de segurança ao nível da linha | |
| Ler o registo de auditoria | |
| Migrar um EUL do Oracle Discoverer | |

## De onde vem o seu acesso

O seu acesso vem da sua função. Não depende de partilhas nem de permissões.

- **Mapas.** Vê todos os mapas ativos, seja quem for o proprietário. Pode alterar, partilhar e eliminar qualquer mapa.
- **Dados.** Pode ler os dados de todas as pastas sem uma permissão de área de negócio. De cada vez que o faz, o sistema escreve uma nota no registo de auditoria.
- **Segurança ao nível da linha.** As políticas de segurança ao nível da linha continuam a aplicar-se a si (veja o capítulo **Políticas de Segurança**).
- **Outras pessoas.** Os utilizadores comuns veem apenas os seus próprios mapas, os mapas públicos e os mapas partilhados com eles. Uma permissão de área de negócio dá acesso a dados. Nunca mostra um mapa.

## Como iniciar sessão, alterar a palavra-passe e terminar sessão

1. Abra o endereço do Discoverer Neo no seu navegador.
2. Escreva o seu **Email** e a sua **Palavra-passe**.
3. Deixe **Manter sessão iniciada** assinalado para continuar com a sessão iniciada depois de fechar o navegador. Desmarque-o num computador partilhado. A sessão termina então quando fechar o navegador.
4. Clique em **Iniciar sessão**.

![A página de início de sessão com Email, Palavra-passe, Manter sessão iniciada e o botão Iniciar sessão.](shots/pt-PT/common/01-login.png)

Depois de cinco palavras-passe erradas, a conta fica bloqueada durante 15 minutos. A mensagem é **Demasiadas tentativas de início de sessão. Tente novamente mais tarde.** Se perder a palavra-passe, outro administrador tem de definir uma nova para si. Não existe uma ligação "esqueci-me da palavra-passe".

A página **Alterar a palavra-passe** abre-se sozinha quando a sua conta tem uma palavra-passe temporária. Escreva a palavra-passe atual e depois a nova, duas vezes. A nova palavra-passe tem de ter pelo menos 12 caracteres e ser diferente da anterior. (A palavra-passe que um administrador define para outra pessoa em **Utilizadores** precisa de apenas 8 caracteres.)

Para terminar a sessão, clique no seu nome no canto superior direito e escolha **Terminar sessão**. Isto termina a sua sessão. Para voltar a usar o Discoverer Neo, inicie sessão novamente.

![O menu da conta aberto, com Definições e Terminar sessão.](shots/pt-PT/common/03-user-menu.png)

## A barra lateral

| Secção | Páginas |
|---|---|
| **Visão Geral** | **Painel** |
| **Modelação de Dados** | **Áreas de Negócio**, **Pastas**, **Itens**, **Junções**, **Hierarquias**, **Funções Personalizadas**, **Origens de Dados**, **Utilizadores**, **Segurança**, **Registo de Auditoria** |
| **Mapas** | **Mapas** |
| **Outros** | **Agendamentos**, **Execuções**, **Exportações**, **Migração** |

**Definições** está no fundo da barra lateral. Num ecrã estreito, a barra lateral esconde-se atrás do botão de menu no canto superior esquerdo (**Alternar menu**).

![A barra lateral completa do administrador, incluindo Modelação de Dados e Migração.](shots/pt-PT/admin/01-dashboard-sidebar.png)

---

# Definições

As **Definições** guardam as suas próprias escolhas. Acompanham a sua conta para qualquer navegador. Abra-as na barra lateral ou no menu do seu nome.

![A página Definições com os cartões Idioma de exibição, Aparência e Paleta.](shots/pt-PT/common/04-settings.png)

| Botão ou controlo | O que faz |
|---|---|
| **Idioma de exibição** | Muda de imediato o idioma dos ecrãs neste navegador. |
| **Aparência** | Muda de imediato o tema neste navegador. |
| **Paleta** | Muda de imediato as cores de destaque neste navegador. |
| **Guardar** | Guarda as suas escolhas na sua conta, para se aplicarem em todos os dispositivos. |

**Idioma de exibição**

| Opção | O que significa / quando escolher |
|---|---|
| English | Ecrãs em inglês. |
| Português (Portugal) | Ecrãs em português. É o predefinido antes de iniciar sessão. |
| Français (France) | Ecrãs em francês. |
| Español (España) | Ecrãs em espanhol. |

**Aparência**

| Opção | O que significa / quando escolher |
|---|---|
| **Claro** | Fundo claro. |
| **Escuro** | Fundo escuro. Mais fácil numa sala com pouca luz. |
| **Alto contraste** | Cores fixas e fortes para uma leitura mais fácil. As escolhas de **Paleta** ficam desativadas enquanto esta estiver selecionada. |

**Paleta**

| Opção | O que significa / quando escolher |
|---|---|
| **Clássica**, **Azul-marinho**, **Floresta**, **Vinho**, **Oceano**, **Ocre** | Seis conjuntos de cores de destaque. Escolha o que preferir. |

> **Atenção:** Uma escolha muda o ecrã de imediato, mas só fica guardada na sua conta quando clica em **Guardar**. Se sair sem guardar, o próximo início de sessão repõe os valores antigos.

---

# Painel

O **Painel** é a página que vê depois de iniciar sessão. Dá-lhe uma contagem rápida do trabalho no sistema. Aqui não pode alterar nada.

![O painel do administrador com os cartões de resumo e a lista Mapas Recentes.](shots/pt-PT/admin/01-dashboard-sidebar.png)

| Cartão | O que mostra |
|---|---|
| **Total de Mapas** | Todos os mapas ativos do sistema. Por baixo: quantos são seus e quantos pertencem a outras pessoas ("N seus, M partilhados consigo"). Para si, "partilhados consigo" significa os mapas de todas as outras pessoas, incluindo os privados. |
| **Total de Execuções** | Todas as execuções de todos os mapas, feitas por qualquer pessoa. |
| **Mapas Agendados** | Quantos mapas têm pelo menos um agendamento ativo que criou. |
| **Resultados Agendados** | Quantos resultados guardados os seus agendamentos produziram. |
| **Mapas Recentes** | Os últimos 5 mapas que criou e alterou. Clique num para o abrir no construtor. |

A ligação **Ver agendamentos** em dois cartões abre a página **Agendamentos**.

---

# Mapas

**Mapas** é a lista de todos os mapas do sistema. Use-a para encontrar um mapa, executá-lo, alterá-lo, partilhá-lo, copiá-lo, entregá-lo a outra pessoa ou eliminá-lo.

![A lista de Mapas, separador Todos, com todos os ícones de linha e a secção Pastas de trabalho por cima.](shots/pt-PT/admin/02-maps-all.png)

## A lista

| Botão ou controlo | O que faz |
|---|---|
| **Criar Mapa** | Abre o construtor de mapas com um mapa vazio. |
| Separadores **Meus**, **Partilhado comigo**, **Todos** | **Meus** mostra os mapas que criou. **Partilhado comigo** mostra os mapas que outras pessoas partilharam consigo. **Todos** mostra todos os mapas do sistema. A página abre em **Todos** se não for proprietário de nenhum mapa. |
| **Procurar mapas por nome…** | Filtra a lista por nome. |
| Filtro **Área de Negócio** | Mostra apenas os mapas de uma área de negócio. |
| **Ordenar por** | **Recentemente atualizado** ou **Nome (A–Z)**. |
| **Limpar** | Remove a pesquisa e o filtro de área de negócio. Só aparece enquanto há um filtro ativo. |
| Nome do mapa | Abre o mapa no construtor. |
| Ícone do olho | Abre o mapa no visualizador, onde o executa e lê as linhas. |
| Ícone do lápis | Abre o mapa no construtor para alterar colunas, condições e disposição. |
| Ícone Copiar | Faz a sua própria cópia do mapa e abre-a para edição. |
| Ícone Partilhar | Abre a caixa de diálogo **Partilhar mapa**. |
| Ícone do calendário | Abre **Agendamentos** com este mapa já escolhido. |
| Ícone Transferir | Abre o visualizador, onde exporta para Excel, CSV ou PDF. |
| Ícone do lixo | Elimina o mapa depois de confirmar. |

As colunas são **Nome**, **Livro**, **Proprietário**, **Área de Negócio**, **Tipo** e **Atualizado**.

Eliminar um mapa retira-o de todas as listas. Só um administrador o pode repor. As suas execuções e agendamentos continuam ligados a ele.

> **Atenção:** Como administrador, pode eliminar qualquer mapa. Verifique primeiro a coluna **Proprietário**.

## Livros

A secção **Pastas de trabalho** aparece no topo quando pelo menos um mapa pertence a um livro. Clique num livro para ver os seus mapas. Use **Procurar pastas de trabalho ou folhas...** para encontrar um.

| Botão ou controlo | O que faz |
|---|---|
| Ícone do lápis numa linha de mapa | Abre esse mapa no construtor. |
| Ícone Copiar | Abre a caixa de diálogo **Copiar**. Cria um livro novo com uma cópia privada de todos os mapas. O original não muda. Escreva o **Nome do novo livro** e clique em **Copiar**. |
| Ícone Partilhar | Abre a caixa de diálogo de partilha do livro. Dá a uma pessoa acesso a todos os mapas do livro de uma só vez. |
| Ícone do lixo | Elimina o livro e todos os seus mapas depois de confirmar. Só um administrador os pode repor. |

## Partilhar um mapa

A partilha decide quem mais pode abrir um mapa e o que pode fazer com ele.

![A caixa de diálogo Partilhar mapa com uma caixa de pesquisa e os botões Pode ver, Pode exportar e Pode editar.](shots/pt-PT/manager/03-share-dialog.png)

1. Clique no ícone Partilhar na linha do mapa.
2. Escreva em **Pesquisar por nome ou email…** para encontrar a pessoa.
3. Clique num nível junto à pessoa. O nível escuro é o que a pessoa tem agora.
4. Para remover o acesso, clique no **✕** junto à pessoa.

| Opção | O que significa / quando escolher |
|---|---|
| **Pode ver** | A pessoa pode abrir e executar o mapa. Não pode exportá-lo, agendá-lo nem alterá-lo. |
| **Pode exportar** | A pessoa pode abrir e executar o mapa, exportar o resultado e pô-lo num agendamento. |
| **Pode editar** | A pessoa pode fazer tudo o que foi dito acima e também alterar o mapa. Não o pode voltar a partilhar. |

Se o mapa for público, a caixa de diálogo mostra **Este mapa é público — qualquer pessoa com a ligação pode vê-lo.** e um botão **Copiar ligação**. Um mapa público pode ser aberto e exportado por todos os utilizadores com sessão iniciada. Torna um mapa público no construtor (veja o capítulo **Construtor de mapas**).

Uma pessoa também precisa de uma permissão de área de negócio sobre os dados do mapa. Sem ela, a pessoa pode abrir o mapa, mas a execução pára com **Sem autorização para executar**.

## Partilhar um livro inteiro

Na caixa de diálogo de partilha do livro, os níveis são os mesmos: **Pode ver**, **Pode exportar**, **Pode editar**. Um clique partilha todos os mapas do livro. A lista mostra "n de m folhas" para cada pessoa. Clique em **✕** para remover o acesso.

## Copiar um mapa

Clique no ícone Copiar. Obtém uma cópia privada de que é proprietário. Pode depois alterá-la. O original fica como está.

## Exemplo: dar acesso de leitura a um colega

Exemplo: partilhar **GD_M.M10_V01.DIS** com um colega que só o deve ler.

1. Em **Mapas**, encontre **GD_M.M10_V01.DIS**.
2. Clique no ícone Partilhar.
3. Procure o nome do seu colega.
4. Clique em **Pode ver**.
5. Verifique que o colega tem uma permissão na área de negócio do mapa (veja **Áreas de Negócio**). Sem ela, a execução é recusada.

---

# Construtor de mapas

O construtor é onde cria e altera um mapa. Abra-o com **Criar Mapa**, ou com o ícone do lápis ou o nome do mapa na lista. Como administrador, pode alterar todos os mapas.

![O construtor de mapas com a árvore Áreas de Negócio, a área de Colunas e o painel Propriedades.](shots/pt-PT/user/05-builder-overview.png)

## O ecrã

- **Esquerda:** a árvore **Áreas de Negócio**. Abra uma área de negócio, depois uma pasta e depois arraste um item para fora.
- **Meio:** a área **Colunas**. Contém as colunas do mapa. Os resultados aparecem por baixo dela depois de uma execução.
- **Direita:** cinco separadores: **Propriedades**, **Condições**, **Ordenação**, **Parâmetros**, **Campos Calculados**.

Pode arrastar as barras entre as zonas para mudar a largura. **Colapsar painel** esconde o lado direito.

## A barra de ferramentas

| Botão ou controlo | O que faz |
|---|---|
| **Voltar** | Regressa à página de onde veio. O construtor não o avisa de alterações não guardadas. |
| Caixa do nome do mapa | O nome do mapa. |
| Lista do tipo de mapa | **Tabela**, **Tabela Cruzada**, **Página-Detalhe** ou **Gráfico**. Só **Tabela Cruzada** muda o aspeto do resultado (veja abaixo). |
| **● Não guardado** | Mostra que o mapa tem alterações que não guardou. |
| **Executar** | Guarda o mapa se for novo ou tiver sido alterado e depois executa-o. |
| **Guardar** | Guarda o mapa. Não existe guardar automático. |
| **Exportar** > **Definição do mapa (.xml)** | Transfere a definição do mapa como um ficheiro XML. Não contém linhas de dados. Só funciona depois de o mapa ser guardado. |
| **Agendar** | Abre **Agendamentos** com este mapa escolhido. Funciona depois de o mapa ser guardado. |
| **Formatação** | Abre a caixa de diálogo de formatação condicional. Funciona depois de o mapa ser guardado. |
| **Partilhar** | Abre a caixa de diálogo **Partilhar mapa**. Funciona depois de o mapa ser guardado. |

| Opção (tipo de mapa) | O que significa / quando escolher |
|---|---|
| **Tabela** | Uma grelha simples de linhas. A predefinida. |
| **Tabela Cruzada** | Uma grelha com valores no topo e ao lado. Precisa de pelo menos uma coluna definida como **No topo**. Se nenhuma estiver definida, o resultado aparece como uma tabela com uma nota. |
| **Página-Detalhe** | Guardado com o mapa, mas o resultado aparece como uma grelha simples. |
| **Gráfico** | Guardado com o mapa, mas o resultado aparece como uma grelha simples. |

## Construir um mapa

1. Clique em **Criar Mapa**.
2. Na árvore **Áreas de Negócio**, abra uma área de negócio e uma pasta.
3. Arraste um item para a área de trabalho, ou clique no **+** junto a ele. Repita para mais colunas.
4. Clique em **Guardar**.

A primeira coluna que adiciona fixa a área de negócio do mapa. Todas as outras colunas têm de vir da mesma área de negócio. O sistema recusa uma coluna de outra área com **Área de negócio diferente**. Uma coluna só pode estar uma vez na área de trabalho. Não existe um seletor de área de negócio.

Exemplo: construir um mapa pequeno na área de negócio **DC**. Arraste uma dimensão (um ícone de etiqueta) e uma medida (um ícone de sigma) para a área de trabalho. Defina a medida como **SUM**. Clique em **Executar**.

Use **Filtrar itens…** por cima da árvore para encontrar um item. Arraste a pega de uma coluna para mudar a ordem. Clique em **X** numa coluna para a remover.

Enquanto constrói, o sistema verifica a forma do mapa. Se ele for ser recusado, uma faixa âmbar explica porquê antes de clicar em **Executar** (veja **Recusas**).

## Configurar uma coluna

Clique numa coluna na área de trabalho. Abre-se a caixa de diálogo **Configurar coluna**. Nada é mantido até clicar em **Guardar** no mapa.

| Botão ou controlo | O que faz |
|---|---|
| **Nome a apresentar** | O título da coluna. Em branco usa o nome do item. |
| **Agregação** | Como a coluna é totalizada. |
| **Direção de ordenação** | Ordena o resultado por esta coluna. |
| **Máscara de formato** | Como os números e as datas são impressos. |
| **Predefinições** | Preenche a **Máscara de formato** a partir de uma lista. |
| **Ordem de ordenação** | A posição da coluna quando ordena por várias colunas. |
| **Largura da coluna (px)** | A largura da coluna. Tem de ser superior a zero. |
| **Colocação** | A função da coluna na disposição. |
| **Margem da tabela cruzada** | Onde uma coluna vai numa tabela cruzada. |
| **Agrupar e quebrar** | Esconde valores repetidos e inicia um subtotal de cada vez que a coluna muda. |
| **Só na consulta, não mostrar** | A consulta pede a coluna, para que uma condição, uma ordenação ou um total a possam usar, mas o resultado não a mostra. |

| Opção (**Agregação**) | O que significa / quando escolher |
|---|---|
| NONE | Sem total. Use para nomes e códigos. |
| SUM | Soma os valores. |
| COUNT | Conta as linhas. |
| AVG | Média. |
| MIN | O menor valor. |
| MAX | O maior valor. |

| Opção (**Direção de ordenação**) | O que significa / quando escolher |
|---|---|
| **Nenhum** | Não ordenar por esta coluna. |
| **Ascendente** | Do menor para o maior, de A a Z. |
| **Descendente** | Do maior para o menor, de Z a A. |

| Opção (**Predefinições**) | O que significa / quando escolher |
|---|---|
| **Número (1.234)** | Número inteiro com separadores de milhares. |
| **Decimal (1.234,00)** | Duas casas decimais. |
| **Moeda (1.234,00 €)** | Dinheiro com o símbolo da moeda. |
| **Percentagem (12,3%)** | Percentagem. |
| **Data (DD-MON-YYYY)** | Data como 31-DEC-2026. |
| **Data (YYYY-MM-DD)** | Data como 2026-12-31. |

| Opção (**Colocação**) | O que significa / quando escolher |
|---|---|
| **Nenhum** | Sem função especial. |
| **Agrupar por (eixo)** | A coluna agrupa as linhas. |
| **Medida** | A coluna contém os números. |
| **Item de página** | A coluna divide o resultado em páginas. |

| Opção (**Margem da tabela cruzada**) | O que significa / quando escolher |
|---|---|
| **Nenhum** | Não é usada numa tabela cruzada. |
| **Ao lado** | Os valores correm ao longo do lado esquerdo. |
| **No topo** | Os valores correm ao longo do topo. |

![A caixa de diálogo Configurar coluna com a lista Agregação aberta.](shots/pt-PT/user/08-builder-column-aggregation.png)

## O separador Propriedades

| Botão ou controlo | O que faz |
|---|---|
| **Descrição** | O título impresso por cima dos resultados e no topo de cada exportação. O texto depois de `&` é uma variável. |
| **Inserir variável** | Coloca uma variável no cursor. |
| **Público (visível para todos na área de negócio)** | Torna o mapa público quando guarda. Na prática, todos os utilizadores com sessão iniciada passam a poder abri-lo e exportá-lo. Os dados continuam a precisar de uma permissão. |
| Contagens | Totais só de leitura de colunas, condições, parâmetros e campos calculados. |

| Opção (**Inserir variável**) | O que significa / quando escolher |
|---|---|
| Data da execução (`&Date`) | A data da execução. |
| Hora da execução (`&Time`) | A hora da execução. |
| Nome do livro (`&Workbook`) | O livro a que o mapa pertence. |
| Nome da folha (`&Worksheet`) | O nome do mapa. |
| Parâmetros introduzidos no momento da execução | Cada parâmetro do mapa como `&Name`. |

## O separador Condições

Uma condição mantém apenas as linhas que cumprem um teste.

| Botão ou controlo | O que faz |
|---|---|
| **Adicionar Condição** | Acrescenta uma linha. Precisa de pelo menos uma coluna na área de trabalho. |
| Caixa de seleção da linha | Seleciona a linha para agrupar. |
| **Agrupar n condições selecionadas** | Agrupa duas ou mais linhas selecionadas num bloco OR. |
| **Desagrupar** | Remove o bloco. |
| **Operador lógico** | Liga a linha à linha anterior: **AND** ou **OR**. |
| **Item da condição** | A coluna a testar. |
| **Operador** | A comparação. |
| **Valor estático** | Um valor fixo na caixa. |
| **Pedir em tempo de execução** | O valor é pedido quando o mapa é executado. Dá nome a um parâmetro. |
| Caixa de valor | O valor. Use `value1, value2, …` para IN e `low, high` para BETWEEN. |
| **Nome do parâmetro** | O parâmetro que fornece o valor. Tem de existir. |
| Lixo | Remove a condição. |

| Opção (**Operador**) | O que significa / quando escolher |
|---|---|
| `=` | Igual a. |
| `<>` | Diferente de. |
| `<`, `>`, `<=`, `>=` | Menor que, maior que, e com igual. |
| LIKE | Corresponde a um padrão com `%` e `_`. |
| IN | Corresponde a um valor de uma lista. |
| BETWEEN | Entre um valor mínimo e um máximo. |
| IS NULL | O valor está vazio. Sem caixa de valor. |

## O separador Ordenação

| Botão ou controlo | O que faz |
|---|---|
| **Escolha uma coluna** | Escolhe a coluna a adicionar. |
| **Adicionar ordenação** | Adiciona o nível de ordenação. |
| Pega | Arraste para mudar a prioridade. |
| Lista de direção | **Ascendente** ou **Descendente**. |
| X | Remove o nível. |

## O separador Parâmetros

Um parâmetro é uma pergunta feita quando o mapa é executado.

| Botão ou controlo | O que faz |
|---|---|
| **Adicionar Parâmetro** | Adiciona um parâmetro chamado Parameter1, Parameter2 e assim por diante. |
| Caixa do nome | O nome. Tem de ser único. |
| Lista de tipo | O tipo de valor. |
| Valor predefinido | Usado quando ninguém escreve um valor. Se todos os parâmetros tiverem um valor predefinido, o mapa é executado sem perguntar. |
| **Obrigatório** | A execução recusa um valor em branco. |
| Lixo | Remove o parâmetro. |
| **Pré-visualização do pedido em tempo de execução** | Mostra o pedido como as pessoas o vão ver. |

| Opção (**Tipo**) | O que significa / quando escolher |
|---|---|
| STRING | Texto. |
| NUMBER | Um número. |
| DATE | Uma data. |
| LIST | Vários valores, separados por vírgulas. |

## O separador Campos Calculados

Um campo calculado é uma coluna nova feita a partir de uma fórmula.

| Botão ou controlo | O que faz |
|---|---|
| **Adicionar Campo Calculado** | Adiciona Calc1, Calc2 e assim por diante. |
| Pega | Reordena os campos. |
| Caixa do nome | O nome. As outras fórmulas chamam-no como `[Name]`. |
| Ordem de apresentação | A posição da coluna. |
| Botão da fórmula | Abre o **Editor de fórmulas**. |
| Lixo | Remove o campo. |

No **Editor de fórmulas**, escreva a fórmula ou clique numa função para a inserir. Clique no nome de uma coluna para inserir `[Column]`. O editor avisa de fórmulas vazias, aspas ou parênteses desequilibrados e funções ou colunas desconhecidas. **Testar fórmula** executa a fórmula nas primeiras 5 linhas de dados reais. Funciona depois de o mapa ser guardado.

| Grupo de funções | O que contém |
|---|---|
| Aritméticas | ROUND, TRUNC, FLOOR, CEIL, ABS, MOD, POWER, SQRT, SIGN, GREATEST, LEAST |
| Texto | UPPER, LOWER, INITCAP, LENGTH, SUBSTR, TRIM, LTRIM, RTRIM, INSTR, REPLACE, CONCAT, LPAD, RPAD |
| Data | TO_CHAR, TO_DATE, ADD_MONTHS, MONTHS_BETWEEN, LAST_DAY |
| Condicionais / tratamento de nulos | NVL, NVL2, COALESCE, DECODE, TO_NUMBER, CASE |

## Formatação condicional

**Formatação** pinta uma célula ou uma linha inteira quando um valor cumpre um teste. As regras são guardadas de imediato. Não esperam por **Guardar**.

| Botão ou controlo | O que faz |
|---|---|
| **Adicionar regra** | Abre o formulário da regra. |
| **Coluna** | A coluna a testar. |
| **Aplicar a** | **Célula** pinta uma célula. **Linha** pinta a linha inteira. |
| **Operador** | O teste. |
| **Valor** | O valor com que comparar. |
| **Cor de fundo**, **Cor do texto** | As cores. **Limpar** remove uma. |
| **Negrito**, **Itálico**, **Sublinhado** | Estilo do texto. |
| **Guardar** | Guarda a regra. |
| X numa regra | Elimina a regra. |

| Opção (**Operador**) | O que significa / quando escolher |
|---|---|
| **Igual a**, **Diferente de** | Mesmo valor ou valor diferente. |
| **Maior que**, **Menor que** | Acima ou abaixo. |
| **Maior ou igual a**, **Menor ou igual a** | Acima ou abaixo, com igual. |
| **Contém (caracteres % e _)** | Correspondência de padrão. |
| **Na lista** | Um de `value1,value2,…`. |
| **Entre** | De `low,high`. |
| **Está vazio** | Sem valor. |

## Executar um mapa e ler o resultado

Clique em **Executar**. Se um parâmetro não tiver valor predefinido, a caixa de diálogo **Parâmetros de execução** abre-se primeiro. Preencha os valores e clique em **Executar**. Os campos obrigatórios em branco mostram **Este parâmetro é obrigatório.**

O painel de resultados mostra o número de linhas e o tempo. **Existem mais linhas disponíveis** significa que o resultado foi cortado. Clique em **Carregar mais** para obter as 500 linhas seguintes.

| Botão ou controlo | O que faz |
|---|---|
| **SQL** | Mostra ou esconde o texto SQL que foi enviado à base de dados. Só você e os outros administradores o veem. |
| **Plano** | Mostra o plano de execução da base de dados. Só administradores. |
| **Excel**, **CSV** | Exporta o resultado. |
| **PDF** | Abre **Exportar para PDF**. |
| Título de coluna | Clique para ordenar as linhas carregadas. |
| Caixa **Filtrar…** | Filtra as linhas carregadas. |
| Duplo clique numa linha | Abre **Ver Detalhe**: as linhas de origem por trás dessa linha. |

**Exportar para PDF**

| Opção | O que significa / quando escolher |
|---|---|
| **Tamanho do papel**: **A4**, **A3**, **Carta** | O tamanho da página. A4 é o predefinido. Use A3 para resultados largos. |
| **Orientação**: **Vertical**, **Horizontal** | Página alta ou larga. Use **Horizontal** para muitas colunas. |
| Lista **Colunas**, **Selecionar todas** / **Limpar** | As colunas a imprimir. Todas começam assinaladas. **Exportar** precisa de pelo menos uma. |

![Os resultados da execução com os botões SQL e Plano junto aos botões Excel, CSV e PDF.](shots/pt-PT/admin/03-viewer-results.png)

Os resultados das execuções são mantidos durante 24 horas. Executar o mesmo mapa novamente com os mesmos valores mostra o resultado guardado ("A mostrar um resultado em cache"). Clique em **Executar novamente** no visualizador para uma execução nova.

## Recusas e erros

O sistema recusa alguns mapas que dariam totais errados. Diz porquê e o que mudar.

| Mensagem | O que fazer |
|---|---|
| Estas pastas não estão ligadas | Remova as colunas da pasta não ligada, ou defina uma junção (veja **Junções**). |
| Uma junção desta folha não tem condição | Defina as colunas em que a junção corresponde. |
| Uma junção desta folha está definida nos dois sentidos ao mesmo tempo | Desligue uma das definições de junção externa. |
| Estes totais são medidos em relação a coisas diferentes | Totalize a partir de um só conjunto de linhas de detalhe. |
| Estas pastas estão ligadas em círculo | Use uma das duas pastas de detalhe. |
| Valores individuais de dois conjuntos de linhas de detalhe | Totalize em vez disso, ou liste a partir de um só conjunto. |
| Expande-se a partir de mais do que uma pasta | Divida em dois mapas. |
| Este tipo de total não pode ser calculado através de uma ligação | Use SUM, COUNT, MIN ou MAX. |

Uma faixa vermelha **Sem autorização para executar** significa que falta uma permissão de área de negócio ou (em modo fechado) que falta uma política de segurança ao nível da linha. Ultrapassa as permissões, mas não a segurança ao nível da linha.

---

# O visualizador de mapas

O visualizador executa um mapa e mostra as linhas. Nunca altera o mapa. Abra-o com o ícone do olho, ou com o nome de um mapa em **Execuções**.

![O visualizador de mapas depois de uma execução concluída, com a grelha de resultados e os botões de exportação.](shots/pt-PT/user/25-viewer-results.png)

| Botão ou controlo | O que faz |
|---|---|
| **Executar** | Executa o mapa. Pede parâmetros se algum não tiver valor predefinido. |
| **Executar novamente** | Executa-o de novo com os mesmos valores e ignora o resultado guardado. Só aparece depois de uma execução concluída. |
| **Cancelar** | Cancela uma execução que ainda está à espera na fila. Só aparece enquanto a execução está em fila. |
| **Gestão de agendamentos** | Abre **Agendamentos**. |
| **Excel**, **CSV**, **PDF** | Exporta o resultado. |
| **SQL**, **Plano** | Só administradores. |

A linha por baixo de **Executar** diz-lhe o estado: em fila, em execução, ou "Resultado de … válido até …". Um mapa migrado pode mostrar um aviso de que alguns filtros do Discoverer não puderam ser migrados. O resultado pode então ter mais linhas do que o original.

---

# Execuções

**Execuções** lista todas as execuções que pediu, em espera, em curso ou concluídas. Use-a para abrir um resultado guardado, executar novamente, exportar ou limpar execuções antigas. Os resultados são mantidos durante 24 horas (execuções em direto) ou durante o tempo de retenção do agendamento (execuções agendadas). A página atualiza-se sozinha.

![A página Execuções com as execuções de todos os utilizadores.](shots/pt-PT/admin/04-runs-every-user.png)

| Botão ou controlo | O que faz |
|---|---|
| Filtro **Mapa** | Mostra apenas um mapa. |
| Filtro **Estado** | Mostra um estado. |
| Filtro **Tipo** | Mostra execuções **Em direto** ou **Agendada**. |
| **Mostrar execuções de todos os utilizadores** | Lista as execuções de todos os utilizadores, não só as suas. Não há coluna de proprietário, por isso as linhas de outros utilizadores não têm nome. |
| Nome do mapa | Abre o mapa no visualizador. |
| Ícone **Abrir** | Abre o resultado guardado. |
| Ícone **Executar novamente** | Inicia uma nova execução do mesmo mapa com os mesmos valores. É uma execução sua, mesmo que a tenha copiado da linha de outro utilizador. |
| Botões **XLSX**, **CSV**, **PDF** | Exportam uma execução concluída que não expirou. |
| Ícone **Cancelar** | Cancela uma execução que está à espera. |
| Ícone **Eliminar** | Elimina uma execução terminada e as respetivas linhas guardadas. Não pode ser anulado. |

| Opção (**Estado**) | O que significa / quando escolher |
|---|---|
| **Em fila** | À espera da sua vez. Cada pessoa executa um mapa de cada vez. |
| **Em execução** | A trabalhar neste momento. |
| **Concluída** | Terminada. O resultado pode ser aberto e exportado. |
| **Falhada** | Interrompida por um erro. |
| **Cancelada** | Interrompida por uma pessoa. |

A coluna **Expira em** mostra o tempo que falta em minutos, horas ou dias, ou **Expirado**.

---

# Exportações

**Exportações** lista os ficheiros que exportou. Mostra apenas as suas próprias exportações. Nem mesmo um administrador pode ver ou transferir a exportação de outra pessoa.

![A página Exportações com a lista de exportações, o respetivo estado e os botões de transferir.](shots/pt-PT/admin/05-exports.png)

| Botão ou controlo | O que faz |
|---|---|
| Ícone Transferir | Guarda o ficheiro. Aparece nas exportações **Concluída**. |
| Etiqueta de estado | **Em fila**, **Em execução**, **Concluída** ou **Falhada**. Aponte para uma falhada para ler o motivo. |

As colunas são **Mapa**, **Formato**, **Estado**, **Linhas** e **Criado**.

| Opção (**Formato**) | O que significa / quando escolher |
|---|---|
| XLSX | Folha de cálculo Excel. |
| CSV | Texto simples com vírgulas. Use-o para carregar os dados noutro programa. |
| PDF | Um documento paginado, feito com o tamanho do papel e as colunas que escolheu. |

Cria uma exportação a partir de uma execução terminada: no visualizador, no construtor, em **Execuções** ou no histórico de um agendamento. Os ficheiros são apagados ao fim de 7 dias. Depois disso, a linha fica, mas a transferência falha.

---

# Agendamentos

Um **agendamento** executa um mapa automaticamente a horas definidas e guarda o resultado. Use-o para relatórios de que precisa todos os dias, semanas ou meses. Mostra apenas os agendamentos que criou. Não envia e-mails. O resultado fica no servidor.

![A página Agendamentos com um agendamento em pausa e os respetivos ícones de ação.](shots/pt-PT/user/38-schedules-list.png)

| Botão ou controlo | O que faz |
|---|---|
| **Novo Agendamento** | Abre o formulário do agendamento. |
| Ícone de reprodução (**Executar agora**) | Executa o agendamento de imediato. Fica desativado enquanto o agendamento está em pausa. |
| Ícone **Pausar** / **Ativar** | Pára ou reinicia o horário. |
| Ícone **Histórico** | Abre o **Histórico de Execuções**. |
| Ícone **Editar** | Altera o agendamento. Não pode alterar o respetivo mapa. |
| Ícone **Eliminar** | Elimina o agendamento e o respetivo histórico depois de confirmar. |

As colunas são **Nome**, **Mapa**, **Agendamento**, **Próxima Execução**, **Formato**, **Estado** (**Ativo** ou **Em pausa**) e **Planeador**. **Planeador** mostra a nota que a migração deixou num agendamento vindo do Discoverer. **Não verificado** é normal nos agendamentos novos. Os agendamentos migrados do Discoverer chegam em pausa.

Um agendamento é executado como o seu criador. Aplicam-se as permissões de área de negócio e as políticas ao nível da linha do criador.

## Novo Agendamento e Editar Agendamento

| Botão ou controlo | O que faz |
|---|---|
| **Mapa** | O mapa a executar. A lista contém os seus mapas e os mapas partilhados consigo, marcados com "(partilhado)". Para agendar o mapa de outro utilizador, use o ícone do calendário em **Mapas**. |
| **Nome** | O nome do agendamento. |
| **Frequência** | Com que frequência é executado. |
| **Fuso horário** | O relógio que o horário segue. |
| **Expressão cron** | O horário em cinco campos. Mostrado apenas para **Personalizado**. |
| **Válido a partir de (opcional)** | O horário começa nesta data e hora. |
| **Válido até (opcional)** | O horário pára depois desta data e hora. |
| **Formato de Saída** | O tipo de ficheiro do resultado guardado. |
| **Predefinições de parâmetros** | Um valor fixo para cada parâmetro do mapa. Mostrado apenas se o mapa tiver parâmetros. |
| **Ativado** | Se o horário está ligado. |

| Opção (**Frequência**) | O que significa / quando escolher |
|---|---|
| **Diariamente (meia-noite)** | Todos os dias às 00:00. |
| **Semanalmente (domingo, meia-noite)** | Todos os domingos às 00:00. |
| **Mensalmente (dia 1, meia-noite)** | No dia 1 de cada mês às 00:00. |
| **Personalizado** | Escreva a sua própria **Expressão cron**, por exemplo `0 9 * * 1-5` (dias úteis às 09:00). Os cinco campos são minuto, hora, dia do mês, mês, dia da semana. |

| Opção (**Formato de Saída**) | O que significa / quando escolher |
|---|---|
| **Excel (.xlsx)** | Uma folha de cálculo. |
| **CSV** | Texto simples com vírgulas. O predefinido. |

O **Fuso horário** oferece UTC, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, America/Sao_Paulo, Europe/London, Europe/Berlin, Europe/Paris, Europe/Moscow, Asia/Kolkata, Asia/Shanghai, Asia/Tokyo, Asia/Dubai e Australia/Sydney. UTC é o predefinido.

Os resultados são mantidos durante 30 dias.

![A caixa de diálogo Novo Agendamento com uma frequência personalizada e o campo Expressão cron.](shots/pt-PT/user/34-schedule-custom-cron.png)

## Histórico de Execuções

**Histórico** mostra as últimas 50 execuções do agendamento: **Executado**, **Estado** (SUCCESS, FAILED ou TIMEOUT), **Linhas** e **Duração**. Aponte para uma linha falhada para ler o erro.

| Botão ou controlo | O que faz |
|---|---|
| **XLSX**, **CSV**, **PDF** | Exportam o resultado guardado de uma execução bem-sucedida. |
| Ícone **Abrir** | Abre o resultado guardado no visualizador. |
| Ícone **Transferir** | Guarda diretamente um ficheiro de resultado mais antigo. |
| "Expira …" | O tempo que falta antes de o resultado ser removido. |

## Exemplo: um resultado semanal

Exemplo: executar **GD_M.M10_V01.DIS** todas as segundas-feiras às 07:00.

1. Em **Mapas**, clique no ícone do calendário no mapa.
2. Em **Novo Agendamento**, escreva um **Nome**.
3. Defina a **Frequência** como **Personalizado** e escreva `0 7 * * 1`.
4. Escolha o seu **Fuso horário**.
5. Deixe **Ativado** assinalado e clique em **Guardar**.
6. Mais tarde, clique no ícone **Histórico** para abrir ou exportar o resultado.

---

# Áreas de Negócio

Uma **área de negócio** é um grupo de pastas relacionadas, por exemplo "Vendas". É a unidade para dar às pessoas acesso a dados.

![A página Áreas de Negócio com a lista de áreas, o botão Nova Área de Negócio e os ícones de linha.](shots/pt-PT/admin/06-business-areas.png)

As colunas são **Nome**, **Descrição**, **Estado** (**Ativo** ou **Inativo**) e **Criado**.

| Botão ou controlo | O que faz |
|---|---|
| **Nova Área de Negócio** | Abre o formulário de criação. |
| Ícone **Gerir concessões** | Abre a caixa de diálogo **Concessões**. |
| Ícone **Editar** | Altera o nome e a descrição. |
| Ícone **Eliminar** | Desativa a área de negócio depois de confirmar. |

Eliminar apenas desativa. Um administrador pode repor a área.

![A caixa de diálogo Nova Área de Negócio com os campos Nome e Descrição.](shots/pt-PT/admin/07-business-areas-new.png)

## Criar uma área de negócio

1. Clique em **Nova Área de Negócio**.
2. Escreva um **Nome** (obrigatório, até 255 caracteres). Escreva uma **Descrição** se quiser.
3. Clique em **Guardar**. Aparece a notificação **Área de negócio criada**.

## Permissões

Uma **permissão** (concessão) dá a uma pessoa um nível de acesso aos dados de uma área de negócio. Só um administrador pode adicionar ou remover permissões. As permissões aplicam-se a uma pessoa, não a uma função. Uma permissão nunca torna um mapa visível.

![A caixa de diálogo Gerir concessões com a lista Permissão aberta.](shots/pt-PT/admin/09-business-areas-grants-permission.png)

| Botão ou controlo | O que faz |
|---|---|
| **Filtrar utilizadores por nome ou e-mail** | Filtra a lista de pessoas. |
| Caixas de seleção de utilizadores | Assinale uma ou várias pessoas. |
| **Permissão** | O nível a dar a cada pessoa assinalada. O texto por baixo explica o nível. |
| **Adicionar** | Dá o nível a cada pessoa assinalada. Fica desativado até assinalar alguém. |
| Etiqueta de nível numa permissão | Mostra o nível que uma pessoa tem. |
| **Revogar** (X) | Remove a permissão dessa pessoa. |
| **Fechar** | Fecha a caixa de diálogo. |

Os seis níveis são uma escada. Cada nível inclui os anteriores. Se uma pessoa tiver várias permissões numa área, prevalece a mais alta.

| Opção (**Permissão**) | O que significa / quando escolher |
|---|---|
| VIEW | Ler os dados nas pastas da área. Executar mapas que são partilhados com a pessoa. Ver as pastas, itens, junções e hierarquias da área. Escolha-o para pessoas que só executam relatórios. |
| EXPORT | Igual a VIEW. Os direitos de exportação num mapa vêm da forma como o mapa é partilhado. |
| SCHEDULE | Igual a VIEW. Os direitos de agendamento num mapa vêm da forma como o mapa é partilhado. |
| CREATE | Tudo o que está em VIEW, mais criar mapas, pastas, itens, junções e hierarquias novos na área. Escolha-o para pessoas que constroem mapas. |
| EDIT | Tudo o que está em CREATE, mais alterar a área e as suas pastas, itens, junções e hierarquias. |
| DELETE | Tudo o que está em EDIT, mais eliminar pastas, itens, junções e hierarquias na área. |

> **Nota:** EXPORT e SCHEDULE não acrescentam nada por si. Se alguém pode exportar ou agendar um mapa depende da forma como o mapa é partilhado. Uma pessoa precisa de pelo menos CREATE para guardar um mapa novo.

> **Nota:** Um Manager nunca altera pastas, itens, junções, hierarquias nem a área, qualquer que seja a permissão que tenha. Para um Manager, CREATE, EDIT e DELETE só lhe permitem criar mapas.

Exemplo: dar a um colega o direito de construir mapas na área de negócio **DC**.

1. Clique no ícone **Gerir concessões** na área.
2. Assinale o seu colega.
3. Defina a **Permissão** como CREATE.
4. Clique em **Adicionar**. Aparece a notificação **Acesso concedido a 1 utilizador**.

Para dar o mesmo nível a várias pessoas, assinale-as todas antes de clicar em **Adicionar**. Se algumas falharem, as notificações comunicam-nas em separado.

---

# Pastas

Uma **pasta** é uma tabela, vista ou consulta dentro de uma área de negócio. As suas colunas tornam-se **itens**. Escolha primeiro uma área de negócio. **Atualizar tudo** e **Nova Pasta** ficam desativados até o fazer.

![A página Pastas com uma área de negócio escolhida, com a tabela de pastas e os ícones de linha.](shots/pt-PT/admin/11-folders.png)

As colunas são **Nome** (com uma etiqueta **Partilhada** para uma pasta que pertence a outra área), **Tipo**, **Nome da Tabela** e **Origem de Dados**.

| Botão ou controlo | O que faz |
|---|---|
| **Área de Negócio** | Escolhe a área cujas pastas vê. |
| **Atualizar tudo** | Volta a ler todas as tabelas e vistas da área a partir da sua origem de dados. As colunas novas tornam-se itens. Os tipos alterados são atualizados. As colunas que desapareceram são apenas listadas. |
| **Nova Pasta** | Abre o assistente de pastas. |
| Ícone **Atualizar a partir da origem de dados** | A mesma atualização para uma pasta. Aparece em pastas de tabela e vista que têm uma origem de dados e não foram partilhadas a partir de outra área. |
| Ícone **Gerir áreas de negócio** | Abre a caixa de diálogo de partilha. |
| Ícone **Editar** | Abre o assistente sobre esta pasta. |
| Ícone **Eliminar** | Desativa a pasta depois de confirmar. |
| Painel **Resultado da atualização**, **Fechar** | Lista o que cada atualização encontrou. |

A atualização nunca elimina um item. Uma coluna que já não existe na origem é listada como "Coluna já não existe na origem (item mantido — apague-o se nenhum mapa o usar)".

As pastas partilhadas a partir de outra área são ignoradas por **Atualizar tudo**. Atualize-as a partir da área a que pertencem.

## O assistente de pastas

| Botão ou controlo | O que faz |
|---|---|
| **Nome** | O nome da pasta. Preenchido a partir da tabela se estiver vazio. |
| **Descrição** | Texto. Preenchido a partir do comentário da tabela Oracle se estiver vazio. |
| **Tipo de Pasta** | O tipo de pasta. |
| **SQL Personalizado** | O SQL que define a pasta. Aparece para **DERIVED** e **COMPLEX**. |
| **Origem de Dados** | A ligação à base de dados. Aparece para todos os tipos exceto **DERIVED** e **COMPLEX**. |
| **Descobrir Tabelas** | Lê as tabelas da origem de dados para poder escolher uma. |
| Caixa de filtro | Filtra a lista descoberta por nome ou comentário. |
| Lista descoberta | Clique numa tabela para preencher **Nome da Tabela**, **Proprietário da Tabela**, **Nome** e **Descrição**. |
| **Nome da Tabela**, **Proprietário da Tabela** | A tabela a usar. Pode escrevê-los. O sistema verifica que a tabela existe e pode ser lida. |
| **Itens a criar (n)** | As colunas da tabela. Cada coluna assinalada torna-se um item. Pode alterar cada descrição. **Selecionar todas** / **Limpar** assinala ou desmarca todas. |
| **Guardar** | Cria a pasta e depois cria os itens. |

| Opção (**Tipo de Pasta**) | O que significa / quando escolher |
|---|---|
| TABLE | Uma tabela da base de dados. A escolha habitual. |
| VIEW | Uma vista da base de dados. |
| DERIVED | Uma pasta definida pelo seu próprio texto em **SQL Personalizado**. |
| COMPLEX | Uma pasta definida pelo seu próprio SQL. O SQL não pode estar vazio e tem de passar a verificação. As políticas de segurança ao nível da linha não funcionam com ela: uma pasta COMPLEX coberta por uma política é recusada. |
| JOIN | Uma pasta que representa uma junção. |
| SUMMARY | Uma pasta de resumo. |

![A caixa de diálogo Nova Pasta com uma tabela escolhida e a lista Itens a criar.](shots/pt-PT/admin/15-folders-picked.png)

Exemplo: criar uma pasta para uma tabela.

1. Escolha a área de negócio e clique em **Nova Pasta**.
2. Deixe o **Tipo de Pasta** em TABLE. Escolha a **Origem de Dados**.
3. Clique em **Descobrir Tabelas**. Escreva parte do nome na caixa de filtro.
4. Clique na tabela. As colunas aparecem em **Itens a criar**.
5. Desmarque as colunas de que não precisa. Clique em **Guardar**.

## Partilhar uma pasta com outra área de negócio

Uma pasta pertence a uma área de negócio. Também pode aparecer noutras, como no Oracle Discoverer. Uma permissão em qualquer uma das suas áreas dá acesso à pasta.

1. Clique no ícone **Gerir áreas de negócio**.
2. Em **Partilhar com**, escolha uma área.
3. Clique em **Partilhar**.
4. Para deixar de partilhar, clique no X na etiqueta. Não pode remover a área proprietária.

![A caixa de diálogo de partilha da pasta com a etiqueta do proprietário e a lista Partilhar com.](shots/pt-PT/admin/16-folders-sharing.png)

---

# Itens

Um **item** é uma coluna de uma pasta. Os mapas são construídos a partir de itens. Escolha uma **Área de Negócio** e depois uma **Pasta**. A lista de pastas inclui as pastas partilhadas a partir de outras áreas.

![A página Itens para uma pasta escolhida, com as colunas Tipo, Coluna, Tipo de Dados e Agregação.](shots/pt-PT/admin/17-items.png)

As colunas são **Nome**, **Tipo**, **Coluna**, **Tipo de Dados** e **Agregação**.

| Botão ou controlo | O que faz |
|---|---|
| **Área de Negócio**, **Pasta** | Escolhem de quem vê os itens. |
| **Novo Item** | Abre o formulário de criação. Fica desativado até uma pasta ser escolhida. |
| Ícone **Editar** | Altera o item. Não o pode mover para outra pasta. |
| Ícone **Eliminar** | Desativa o item depois de confirmar. |

Os itens são normalmente criados pelo assistente de pastas. Esta página não tem botão de importação.

| Botão ou controlo | O que faz |
|---|---|
| **Nome** | O nome do item. Obrigatório. |
| **Descrição** | Texto opcional. |
| **Tipo de Item** | O tipo de item. |
| **Nome da Coluna** | A coluna física. Só aparece para **Item de Base de Dados (CO)**. |
| **Fórmula** | O cálculo. Aparece para todos os tipos exceto CO. Uma fórmula inválida é recusada. |
| **Tipo de Dados** | Por exemplo NUMBER. |
| **Máscara de Formato** | Por exemplo `999,999.00`. |
| **Agregação** | O total predefinido do item. |

| Opção (**Tipo de Item**) | O que significa / quando escolher |
|---|---|
| **Item de Base de Dados (CO)** | Uma coluna da tabela. A escolha habitual. |
| **Item Criado (CI)** | Um item que criou, usando uma fórmula. |
| **Item Calculado (CU)** | Um item calculado, usando uma fórmula. |
| **Item de Junção (JI)** | Um item que vem através de uma junção. |
| **Item de Hierarquia (HI)** | Um item que é um nível de uma hierarquia. |
| **Agregação (AG)** | Um item que totaliza outros itens. |
| **Função (FU)** | Um item que chama uma função personalizada. |

| Opção (**Agregação**) | O que significa / quando escolher |
|---|---|
| NONE | Sem total predefinido. Não guarda nada. |
| SUM, COUNT, AVG, MIN, MAX | O total predefinido para este item quando é usado num mapa. Escolha SUM para montantes. |

![A caixa de diálogo Novo Item com a lista Tipo de Item aberta, a mostrar os tipos de item.](shots/pt-PT/admin/19-items-type-open.png)

---

# Junções

Uma **junção** diz ao sistema como duas pastas se ligam, para que um mapa possa usar colunas de ambas. Escolha primeiro uma área de negócio.

![A página Junções, incluindo junções feitas de vários pares de colunas.](shots/pt-PT/admin/20-joins.png)

As colunas são **Nome**, **Pasta Esquerda**, **Pasta Direita**, **Colunas** (pares mostrados como `left op right`, unidos com AND) e **Tipo**.

| Botão ou controlo | O que faz |
|---|---|
| **Área de Negócio** | Escolhe a área. |
| **Nova Junção** | Abre o formulário da junção. |
| Ícone **Editar** | Altera a junção. |
| Ícone **Eliminar** | Desativa a junção depois de confirmar. |

| Botão ou controlo | O que faz |
|---|---|
| **Nome** | O nome da junção. Obrigatório. Preenchido por uma sugestão se estiver vazio. |
| **Pasta Esquerda**, **Pasta Direita** | As duas pastas. Ambas têm de pertencer à área. |
| **Sugerir Junções** | Procura nomes de colunas correspondentes entre pastas e lista-os. Trabalha a partir da pasta esquerda. Clique numa sugestão para preencher o formulário. |
| **Item Esquerdo**, **Operador**, **Item Direito** | Um par de colunas e como se comparam. |
| X num par | Remove o par. O último par não pode ser removido. |
| **Adicionar par de colunas** | Acrescenta outro par. Todos os pares têm de corresponder (AND). Isto dá uma junção em várias colunas. |
| **Tipo de Junção** | O tipo de junção. |

| Opção (**Operador**) | O que significa / quando escolher |
|---|---|
| `=` | As colunas são iguais. Quase sempre a escolha certa. |
| `<>`, `<`, `<=`, `>`, `>=` | Outras comparações. Raras. |

| Opção (**Tipo de Junção**) | O que significa / quando escolher |
|---|---|
| INNER | Só as linhas que correspondem em ambos os lados. A predefinida. |
| LEFT | Todas as linhas da pasta esquerda, com ou sem correspondência. |
| RIGHT | Todas as linhas da pasta direita, com ou sem correspondência. |

Não existe junção completa, de propósito.

![A caixa de diálogo Nova Junção com uma lista de seleção aberta.](shots/pt-PT/admin/23-joins-select-open.png)

Exemplo: ligar duas pastas.

1. Escolha a área e clique em **Nova Junção**.
2. Escolha a **Pasta Esquerda** e a **Pasta Direita**.
3. Clique em **Sugerir Junções** e clique na sugestão adequada.
4. Verifique o **Tipo de Junção** e clique em **Guardar**.

---

# Hierarquias

Uma **hierarquia** é uma lista ordenada de itens, do mais abrangente ao mais estreito, por exemplo Ano, Trimestre, Mês. Define como aprofundar. Escolha primeiro uma área de negócio.

![A página Hierarquias com a tabela a mostrar o número de níveis.](shots/pt-PT/admin/24-hierarchies.png)

As colunas são **Nome** e **Níveis**.

| Botão ou controlo | O que faz |
|---|---|
| **Área de Negócio** | Escolhe a área. |
| **Nova Hierarquia** | Abre o formulário. |
| Ícone **Editar** | Abre a hierarquia com os seus níveis. |
| Ícone **Eliminar** | Desativa a hierarquia depois de confirmar. |

| Botão ou controlo | O que faz |
|---|---|
| **Nome**, **Descrição** | Campos de texto. |
| **Adicionar Nível** | Acrescenta um nível no fim. |
| Pega de arrastar | Arraste para reordenar. A ordem é a ordem de aprofundamento (de cima para baixo). |
| **Nome do nível** | O nome do nível. |
| **Pasta**, **Item** | O item que é este nível. Escolher uma pasta nova limpa o item. |
| X num nível | Remove o nível. |
| **Guardar** | Fica desativado até a hierarquia ter um nome, pelo menos um nível, e cada nível ter um nome e um item. |

> **Atenção:** A lista **Pasta** também mostra pastas partilhadas a partir de outras áreas, mas uma hierarquia só aceita itens de pastas que pertencem à sua própria área. Um item de uma pasta partilhada a partir de outra área é recusado quando guarda.

![A caixa de diálogo Nova Hierarquia depois de adicionar um nível, com as listas de pasta e item.](shots/pt-PT/admin/26-hierarchies-level-added.png)

---

# Funções Personalizadas

Uma **função personalizada** regista uma função que existe na base de dados Oracle, para que os itens calculados a possam chamar. Não tem área de negócio.

![A página Funções Personalizadas com a caixa de filtro, Atualizar tudo, Nova Função e a tabela de funções.](shots/pt-PT/admin/27-custom-functions.png)

As colunas são **Nome**, **Tipo**, **Função da Base de Dados** (`OWNER.PACKAGE.NAME`, com `@LINK` se existir), **Origem de Dados**, **Parâmetros** e **Tipo de Retorno**.

| Botão ou controlo | O que faz |
|---|---|
| **Atualizar tudo** | Volta a ler do Oracle todas as funções que têm uma origem de dados e escreve de volta as assinaturas alteradas. Recompila os campos calculados se algo mudou. As funções que já não existem no Oracle são apenas listadas e mantidas. |
| **Nova Função** | Abre o formulário. |
| **Filtrar por nome ou função da base de dados…** | Filtra a tabela. |
| Ícone **Atualizar a partir da base de dados** | Atualiza uma função. |
| Ícone **Editar** | Altera a função. |
| Ícone **Eliminar** | Desativa a função depois de confirmar. |
| Painel **Resultado da atualização**, **Fechar** | Lista o que mudou, o que desapareceu e o que falhou. |

## O formulário da função

| Botão ou controlo | O que faz |
|---|---|
| **Origem de dados** | Onde a função existe. Escolhida por si se só existir uma. |
| **Proprietário**, **Procurar uma função**, **Procurar** | Procura funções e packages na base de dados Oracle. Só funciona para uma origem de dados Oracle. Clique num resultado para preencher o formulário. Os resultados que não podem ser chamados a partir de SQL aparecem a cinzento com o motivo. |
| **Proprietário**, **Package**, **Nome da função**, **Database link** | As partes do endereço da função. Use letras, dígitos, `_`, `$` ou `#`, começando por uma letra. |
| **Nome**, **Descrição** | O nome que as pessoas veem e um texto. |
| **Tipo de Função** | O tipo de função. |
| **Tipo de Retorno** | Por exemplo NUMBER. |
| **Parâmetros (JSON)** | Uma lista de parâmetros. Cada um precisa de um nome e de um tipo, por exemplo `[{ "name": "p_id", "type": "NUMBER", "required": true }]`. |

| Opção (**Tipo de Função**) | O que significa / quando escolher |
|---|---|
| SQL | Uma função escrita em SQL. |
| PLSQL | Uma função PL/SQL autónoma. A predefinida. |
| PACKAGE | Uma função dentro de um package. A pesquisa escolhe este quando encontra um package. |

![A caixa de diálogo Nova Função Personalizada com as funções da base de dados que correspondem à pesquisa.](shots/pt-PT/admin/29-custom-functions-search-results.png)

---

# Origens de Dados

Uma **origem de dados** é uma ligação guardada a uma base de dados. As áreas de negócio, as pastas e as migrações usam-na. As palavras-passe são guardadas no servidor e nunca voltam a ser mostradas.

![A página Origens de Dados com uma tabela de ligações e cinco ícones de linha.](shots/pt-PT/admin/30-data-sources.png)

As colunas são **Nome**, **Tipo**, **Anfitrião**, **Estado** e **Criado**.

| Botão ou controlo | O que faz |
|---|---|
| **Nova Origem de Dados** | Abre o formulário da ligação. |
| Ícone **Testar ligação** | Tenta ligar-se com os dados guardados. O resultado aparece numa notificação e numa caixa por cima da tabela. |
| Ícone **Introspetar esquema** | Volta a ler o esquema Oracle. A notificação diz quantas tabelas foram encontradas. Só funciona para Oracle. |
| Ícone **Importar tabelas** | Abre **Importar tabelas**. |
| Ícone **Editar** | Altera a ligação. |
| Ícone **Eliminar** | Desativa a origem de dados depois de confirmar. |

| Botão ou controlo | O que faz |
|---|---|
| **Nome** | Tem de ser único. |
| **Tipo de Ligação** | O tipo de base de dados. |
| **Anfitrião**, **Porta** | Onde está o servidor. |
| **Nome do Serviço**, **SID** | Mostrados apenas para Oracle. |
| **Nome de Utilizador** | A conta da base de dados. |
| **Palavra-passe** | A palavra-passe da conta. Ao editar, deixe em branco para manter a guardada. |

| Opção (**Tipo de Ligação**) | O que significa / quando escolher |
|---|---|
| **Oracle** | Uma base de dados Oracle. Necessária para a introspeção, a procura de funções e a migração. |
| **PostgreSQL** | Uma base de dados PostgreSQL. |

## Importar tabelas

**Importar tabelas** transforma muitas tabelas em pastas de uma só vez.

1. Clique no ícone **Importar tabelas**.
2. Escreva o **Proprietário da Tabela / Esquema** (o nome de utilizador da origem de dados é o predefinido).
3. Clique em **Descobrir Tabelas**.
4. Escolha a **Área de Negócio** que será proprietária das pastas novas.
5. Assinale as tabelas que quer.
6. Clique em **Importar n tabela(s)**. A notificação diz quantas pastas foram criadas e quantas foram ignoradas por já existirem.

![A caixa de diálogo Importar tabelas com o botão Descobrir Tabelas, antes de ser encontrada qualquer tabela.](shots/pt-PT/admin/34-data-sources-import-dialog.png)

---

# Utilizadores

**Utilizadores** lista todas as contas. Use-a para adicionar pessoas, alterar funções, desligar contas e entregar mapas a outras pessoas.

![A página Utilizadores com os botões Ficheiro de credenciais e Novo Utilizador e os ícones de linha.](shots/pt-PT/admin/35-users.png)

As colunas são **Nome**, **Email**, **Função** e **Estado** (**Ativo** ou **Inativo**).

| Botão ou controlo | O que faz |
|---|---|
| **Ficheiro de credenciais** | Dá uma nova palavra-passe temporária a todas as contas ativas que ainda têm uma e transfere a lista como um ficheiro CSV. |
| **Novo Utilizador** | Abre o formulário de criação. |
| Ícone **Mapas que este utilizador pode abrir** | Abre a lista de mapas que esta pessoa pode abrir, e porquê. |
| Ícone **Editar** | Altera nome, email, palavra-passe ou função. |
| Ícone **Desativar** | Desliga a conta. Aparece em contas ativas. |
| Ícone **Ativar** | Volta a ligar a conta, sem perguntar. Aparece em contas inativas. |
| Ícone **Eliminar** | Elimina a conta de forma definitiva. |

Não pode desativar nem eliminar a sua própria conta. Esses ícones aparecem a cinzento na sua linha.

## Criar ou alterar um utilizador

| Botão ou controlo | O que faz |
|---|---|
| **Nome** | Obrigatório, até 255 caracteres. |
| **Email** | O endereço de início de sessão. Tem de ser único. |
| **Palavra-passe** | Pelo menos 8 caracteres. Ao editar, deixe em branco para manter a antiga. Uma palavra-passe que definir não obriga a pessoa a alterá-la. |
| **Função** | O tipo de conta. A lista por baixo explica cada função. |

| Opção (**Função**) | O que significa / quando escolher |
|---|---|
| ADMIN | Faz tudo: utilizadores, áreas de negócio, origens de dados, segurança e auditoria. Abre, altera, partilha e elimina todos os mapas. Dê-a a muito poucas pessoas. |
| MANAGER | Abre, executa, exporta, agenda e partilha todos os mapas, e altera quem é o proprietário de um mapa. Só altera os seus próprios mapas e os mapas partilhados como **Pode editar**. Não pode alterar áreas de negócio, pastas, itens, junções nem hierarquias, qualquer que seja a permissão que tenha. Não pode usar **Segurança**, **Registo de Auditoria** nem **Migração**. |
| USER | Vê os seus próprios mapas, os mapas públicos e os mapas partilhados consigo. Executa, exporta e agenda conforme cada partilha o permite. Copia mapas e cria mapas novos onde tem uma permissão CREATE. A predefinida. |
| VIEWER | Como USER, mas não pode copiar mapas nem livros. Para uma pessoa que só deve ler, partilhe mapas como **Pode ver** e não dê nenhuma permissão CREATE. |

> **Nota:** O texto curto por baixo da lista **Função** no ecrã é um resumo. A tabela acima é o que cada função realmente pode fazer.

Uma alteração de função aplica-se no próximo clique da pessoa. Ela não precisa de iniciar sessão novamente.

![A caixa de diálogo Novo Utilizador com a lista Função aberta e cada função descrita.](shots/pt-PT/admin/37-users-role-open.png)

## Desativar, ativar ou eliminar

- **Desativar** mantém a conta e o respetivo histórico. A pessoa é desligada no pedido seguinte e não pode iniciar sessão até ativar a conta. Use-o quando alguém sai ou está ausente.
- **Ativar** volta a ligar a conta de imediato.
- **Eliminar** remove a conta de forma definitiva e não pode ser anulado. A confirmação avisa disso e lista o que desaparece com a conta: os seus agendamentos, execuções e exportações. Se tiver dúvidas, use **Desativar**.

![A caixa de diálogo de confirmação mostrada antes de desativar um utilizador.](shots/pt-PT/admin/39-users-deactivate-dialog.png)

> **Atenção:** **Eliminar** é permanente. **Desativar** não é.

## O ficheiro de credenciais

As contas migradas começam com uma palavra-passe temporária e têm de a alterar antes de poderem fazer alguma coisa. **Ficheiro de credenciais** cria uma nova palavra-passe temporária para cada conta ativa que ainda tenha uma e transfere um CSV. Cada clique gera palavras-passe novas, por isso guarde o ficheiro em segurança e entregue a cada pessoa apenas a sua linha. As contas inativas ou que representam funções da base de dados são ignoradas.

## Mapas que este utilizador pode abrir

O ícone abre **Mapas de <name>**. Lista exatamente o que a pessoa vê na sua própria página **Mapas**, com o proprietário e o motivo.

![A caixa de diálogo Mapas de um utilizador, com etiquetas de origem e listas de nível de partilha.](shots/pt-PT/admin/41-users-maps-dialog.png)

| Etiqueta | O que significa |
|---|---|
| Administrador | A pessoa é administradora e vê todos os mapas. |
| Proprietário | A pessoa é proprietária do mapa. |
| Partilhado | O mapa foi partilhado com a pessoa. |
| Público | O mapa é público. |
| Função de gestor | A pessoa é gestora e vê todos os mapas. |

| Botão ou controlo | O que faz |
|---|---|
| Nome do mapa | Abre o mapa no visualizador. |
| Lista do nível de partilha | Para um mapa partilhado, altera o nível: **Pode ver**, **Pode exportar**, **Pode editar**. |
| Ícone de entregar mapa | Mostra a lista **Novo proprietário**. |
| **Novo proprietário** | Escolha um utilizador ativo. O mapa passa para essa pessoa. Ela pode alterá-lo, partilhá-lo e eliminá-lo. |
| Ícone X | Remove este mapa da pessoa de imediato, sem perguntar. |

Exemplo: um colega sai. Abra **Mapas que este utilizador pode abrir** para esse colega. Para cada mapa de que é proprietário, clique no ícone de entregar mapa e escolha o novo proprietário. Depois clique em **Desativar** na conta.

---

# Políticas de Segurança

As **Políticas de Segurança** controlam a **segurança ao nível da linha**: que linhas de uma pasta cada pessoa pode ver. Uma **política** contém uma ou mais **regras**. Cada regra aponta para uma área de negócio ou uma pasta e contém um filtro escrito como um teste SQL. O filtro é acrescentado a todas as consultas que uma pessoa abrangida pela política executa.

![A página Políticas de Segurança com os botões Testar e Nova Política.](shots/pt-PT/admin/43-security.png)

> **Atenção:** O que acontece a uma pasta que nenhuma política cobre depende de uma definição da instalação (`ROW_LEVEL_FAIL_MODE`). **Fechado**, o predefinido: ninguém vê as suas linhas, administradores incluídos, e as execuções param com "Refusing to run unfiltered". **Aberto**: todos os que têm uma permissão veem todas as suas linhas. Pergunte a quem instalou o sistema que modo o seu usa. No modo fechado, escreva e atribua políticas antes de as pessoas executarem mapas.

As colunas são **Nome**, **Descrição**, **Estado**, **Regras** e **Atribuições**.

| Botão ou controlo | O que faz |
|---|---|
| **Testar** | Abre **Testar uma política**. |
| **Nova Política** | Abre o formulário da política. |
| Ícone **Atribuições** | Abre a caixa de diálogo **Atribuições**. |
| Ícone **Editar** | Altera a política. |
| Ícone **Eliminar** | Elimina a política depois de confirmar. |

## Escrever uma política

| Botão ou controlo | O que faz |
|---|---|
| **Nome** | Obrigatório. |
| **Descrição** | Texto opcional. |
| **Ativo** | Uma política inativa não é aplicada. |
| **Adicionar regra** | Acrescenta outra regra. Uma política precisa de pelo menos uma. |
| **Aplica-se a** | Para que a regra aponta. |
| **Área de Negócio**, **Pasta** | O destino. **Pasta** lista as pastas da área escolhida. |
| **Predicado SQL (fragmento da cláusula WHERE)** | O filtro. Não pode estar vazio. |
| **Validar** | Verifica o filtro. **Predicado válido** significa que está bom. |
| **Remover regra** | Remove a regra. |

| Opção (**Aplica-se a**) | O que significa / quando escolher |
|---|---|
| **Área de Negócio** | A regra abrange todas as pastas da área. |
| **Pasta** | A regra abrange uma pasta. |

No filtro pode usar `:current_user_id`, `:current_user_email` e `:current_user_role`. Use `{alias}` para o nome da pasta dentro da consulta. Exemplo: `{alias}.REGION = 'NORTH'`. Todos os filtros que correspondem são unidos com AND.

> **Nota:** Uma pasta COMPLEX coberta por uma política é recusada. Use outro tipo de pasta se a pasta precisar de uma política.

![A caixa de diálogo Nova Política depois de clicar em Validar num predicado.](shots/pt-PT/admin/46-security-validate.png)

## Atribuir uma política

Uma política aplica-se a cada pessoa atribuída e a todos os que têm uma função atribuída.

| Opção (**Atribuir a**) | O que significa / quando escolher |
|---|---|
| **Utilizador** | Uma pessoa com nome. Escolha-a em **Utilizador**. |
| **Função** | Todos os que têm essa função: ADMIN, MANAGER, USER ou VIEWER. Escolha-a em **Função**. |

1. Clique no ícone **Atribuições**.
2. Escolha **Utilizador** ou **Função** e depois escolha a pessoa ou a função.
3. Clique em **Atribuir**. Aparece a notificação **Política atribuída**.
4. Para remover, clique no ícone **Remover atribuição**.

Uma política sem atribuição não dá linhas a ninguém ("Não atribuída — esta política não dá linhas a ninguém").

## Testar uma política

**Testar** mostra onde os filtros ficam numa consulta de exemplo. Não executa a consulta. Escolha a **Política**, edite a **Consulta de exemplo** (a predefinida é `SELECT * FROM SALES`) e clique em **Executar teste**. O resultado aparece em **Consulta com predicados de segurança**.

---

# Registo de Auditoria

O **Registo de Auditoria** regista todas as alterações e eventos de início de sessão no sistema. Use-o para descobrir quem fez o quê e quando. É só de leitura.

![A página Registo de Auditoria com o botão de exportação, os cartões de estatísticas, o gráfico diário e os filtros.](shots/pt-PT/admin/47-audit.png)

O topo da página mostra **Total de Ações**, **Ações Principais** e **Ações por Dia**.

| Botão ou controlo | O que faz |
|---|---|
| **Exportar CSV (esta página)** | Guarda as linhas no ecrã (até 25) como CSV. Não é o registo completo. |
| Filtro **Utilizador** | Mostra as ações de uma pessoa. **Todos os utilizadores** remove-o. |
| **Tipo de Entidade** | Mostra um tipo de objeto. Escreva o texto exato, por exemplo `maps`. |
| **Ação** | Mostra uma ação. Escreva o texto exato, por exemplo `POST /api/maps`. |
| **De**, **Até** | O intervalo de datas. |
| **Limpar** | Remove todos os filtros. |
| Ícone **Ver detalhes** | Abre **Detalhes da entrada de auditoria** com a entrada completa. |
| **Anterior**, **Seguinte** | Movem-se entre páginas de 25 linhas. |

As colunas são **Data/Hora**, **Utilizador**, **Ação**, **Entidade** e **Endereço IP**. Um utilizador em branco mostra **Sistema / não autenticado**.

O que é registado: todos os pedidos que alteram alguma coisa (criar, alterar, eliminar, iniciar sessão, terminar sessão, exportar, migração) e a leitura de áreas de negócio, pastas, itens, junções, hierarquias, funções personalizadas e origens de dados. As palavras-passe e os tokens nunca são guardados. Os filtros de texto correspondem ao texto completo e distinguem maiúsculas de minúsculas.

Quando lê os dados de uma pasta sem uma permissão, o registo regista-o como uma exceção de administrador.

---

# Migração

A **Migração** traz um End User Layer (EUL) do Oracle Discoverer (o local onde o Discoverer guardava as suas áreas de negócio, pastas, itens, utilizadores e livros) para o Discoverer Neo. É poderosa. Escreve muitos objetos nesta base de dados.

> **Atenção:** Faça sempre primeiro uma **simulação** e leia o relatório. Uma migração real escreve na base de dados do Discoverer Neo. **Reimportar mapas** substitui todos os mapas na área de negócio "Migrated Workbooks", pelo que as edições feitas desde a primeira migração se perdem, tal como os agendamentos, partilhas, execuções e exportações desses mapas. Prefira **Reimportar tudo**, que os mantém.

![A página Migração com o cartão da origem, os respetivos botões e o texto de ajuda.](shots/pt-PT/admin/50-migration.png)

A origem é uma **origem de dados** Oracle que registou primeiro (veja **Origens de Dados**). A palavra-passe guardada dela é usada no servidor. Nenhuma palavra-passe é escrita nesta página.

## Escolher a origem

| Botão ou controlo | O que faz |
|---|---|
| **Origem de dados Oracle** | A ligação Oracle que contém o EUL. |
| **Proprietário do esquema EUL (opcional)** | O esquema que é proprietário do EUL, por exemplo `EUL5_US`. |
| **Versão do EUL** | A versão do EUL. |
| **Detetar versão** | Descobre a versão e mostra o cartão **Origem detetada**. |
| **Analisar** | Verifica a preparação e a complexidade. Preenche o cartão **Avaliação**. |
| **Simulação (validar sem escrever)** | Ativada por predefinição. As execuções são apenas um teste e não escrevem nada. |
| **Executar simulação** / **Executar migração** | Inicia a tarefa. O nome segue a caixa **Simulação**. |
| **Reimportar mapas** | Reconstrói os mapas de uma base de dados que já foi migrada. |
| **Reimportar tudo** | Repete toda a migração com a versão atual. |
| **Compilar campos calculados** | Verifica todos os campos calculados e escreve o SQL que os mapas executam. |

| Opção (**Versão do EUL**) | O que significa / quando escolher |
|---|---|
| **Deteção automática** | O sistema descobre a versão. Escolha-a primeiro. |
| **Forçar EUL4** | Tratar a origem como Discoverer 4. |
| **Forçar EUL5** | Tratar a origem como Discoverer 9i, 10g ou 11g. |

## O que faz cada ação

| Ação | O que faz |
|---|---|
| **Executar migração** | Uma primeira migração de um destino vazio. Não pode ser executada num destino que já contém uma migração (**A base de dados de destino já foi migrada**). Use antes uma reimportação. |
| **Reimportar mapas** | Reconstrói apenas os mapas, a partir dos livros no EUL. Substitui todos os mapas na área de negócio "Migrated Workbooks" e elimina com eles os respetivos agendamentos e partilhas. Não toca em utilizadores, pastas, itens e permissões. |
| **Reimportar tudo** | Reescreve, objeto a objeto, tudo o que agora difere: áreas de negócio, pastas, itens, junções, hierarquias, funções, utilizadores, permissões e mapas. Nada é eliminado. Os ids dos mapas mantêm-se, por isso os agendamentos e as partilhas são mantidos. Os objetos removidos do EUL são apenas comunicados. Uma execução real termina com a compilação dos campos calculados. |
| **Compilar campos calculados** | Use-o se um mapa disser que um campo "não foi compilado". Uma migração e uma reimportação já fazem isto no fim. Não lê o EUL. |

Os botões ficam desativados enquanto uma tarefa está em curso, ou quando nenhuma origem de dados está escolhida. **Compilar campos calculados** funciona mesmo sem origem de dados.

## Fazer uma migração em segurança

1. Registe a origem de dados Oracle em **Origens de Dados** e teste-a.
2. Escolha-a aqui. Clique em **Detetar versão** e depois em **Analisar**. Leia a **Avaliação**: preparação, bloqueios e avisos.
3. Deixe **Simulação** assinalada. Clique em **Executar simulação**.
4. Leia o relatório: **Linhas que seriam inseridas**, o resumo, a reconciliação e o **Registo da migração**.
5. Quando a simulação estiver limpa, desmarque **Simulação**. Aparece o aviso "Uma migração real escreve nesta base de dados do Discoverer Neo". Clique em **Executar migração**.
6. Abra **Utilizadores**. As contas migradas não podem iniciar sessão até terem uma palavra-passe. Clique em **Ficheiro de credenciais** e distribua as palavras-passe.
7. Reveja os mapas na área de negócio "Migrated Workbooks" e mova cada um para a área a que pertence.

O cartão **Avaliação** mostra uma pontuação de preparação em 100, a complexidade, o esforço estimado, contagens do que foi encontrado, a cobertura da disposição das folhas, bloqueios e avisos.

---

# Perguntas frequentes

**Não consigo ver um mapa que um colega vê. Ou um colega não consegue ver o meu mapa.**
Vê todos os mapas, por isso o problema é do colega. Abra **Utilizadores**, clique em **Mapas que este utilizador pode abrir** e verifique a etiqueta. Se o mapa não estiver lá, partilhe-o (**Pode ver** no mínimo) ou torne-o público.

**Um utilizador abre um mapa mas a execução pára com "Sem autorização para executar".**
O mapa é visível, mas a pessoa não tem permissão na área de negócio das suas pastas. Adicione uma permissão em **Áreas de Negócio**. No modo fechado, a falta de uma política de segurança ao nível da linha dá a mesma faixa.

**Toda a gente recebe "Refusing to run unfiltered".**
A instalação executa a segurança ao nível da linha em modo fechado e nenhuma política cobre a pasta. Escreva uma política em **Políticas de Segurança** e atribua-a.

**Uma pessoa pode ver um mapa mas não pode exportá-lo nem agendá-lo.**
A sua partilha é **Pode ver**. Altere-a para **Pode exportar**. Os mapas públicos podem ser exportados mas não agendados.

**Um utilizador migrado não consegue iniciar sessão.**
A conta ainda não tem palavra-passe. Use **Ficheiro de credenciais** em **Utilizadores**. Se a pessoa estiver desativada, clique em **Ativar**.

**Não consigo eliminar nem desativar a minha própria conta.**
É assim por definição. Fale com outro administrador.

**A página Execuções mostra apenas as minhas execuções.**
Assinale **Mostrar execuções de todos os utilizadores**.

**Não consigo transferir uma exportação feita por outra pessoa.**
As exportações são privadas, mesmo para administradores. Peça à pessoa que exporte novamente.

**Um agendamento que fiz para o mapa de outra pessoa não está na lista.**
A página **Agendamentos** lista apenas os agendamentos que criou. A lista **Mapa** no formulário mostra os seus mapas e os mapas partilhados consigo. Para agendar o mapa de outra pessoa, use o ícone do calendário em **Mapas**.

**Um campo calculado diz que "não foi compilado".**
Clique em **Compilar campos calculados** em **Migração**.

## Glossário

| Termo | Significado |
|---|---|
| Mapa | Um relatório. No Oracle Discoverer era uma folha de cálculo. |
| Livro | Um grupo de mapas. |
| Área de negócio | Um grupo de dados relacionados. A unidade das permissões. |
| Pasta | Uma tabela, vista ou consulta numa área de negócio. |
| Item | Uma coluna de uma pasta. |
| Junção | Uma regra que liga duas pastas. |
| Hierarquia | Uma lista ordenada de itens usada para aprofundar. |
| Permissão | Um nível de acesso a uma área de negócio, dado a uma pessoa. |
| Execução | Uma execução de um mapa. O seu resultado é guardado durante algum tempo. |
| Exportação | Um ficheiro (XLSX, CSV ou PDF) feito a partir de uma execução terminada. |
| Agendamento | Um horário que executa um mapa automaticamente e guarda o resultado. |
| Partilha | Acesso a um mapa, dado a uma pessoa: **Pode ver**, **Pode exportar** ou **Pode editar**. |
| Mapa público | Um mapa que todos os utilizadores com sessão iniciada podem abrir e exportar. |
| Origem de dados | Uma ligação guardada a uma base de dados. |
| Segurança ao nível da linha | Regras que decidem que linhas de uma pasta uma pessoa vê. |
| EUL | End User Layer. Onde o Oracle Discoverer guardava os seus metadados. |
| Simulação | Um teste de migração que não escreve nada. |
