# A sua função num relance

É um **Manager**. Vê todos os mapas do Discoverer Neo, executa-os, exporta-os, agenda-os e partilha-os. Cuida de quem pode abrir o quê. Não altera o modelo de dados. Isso é trabalho de um administrador.

Um **mapa** é um relatório (no Oracle Discoverer, era uma folha de cálculo). Um **livro** é um grupo de mapas. Uma **área de negócio** é um grupo de dados relacionados. Uma **pasta** é uma tabela ou vista dentro de uma área de negócio, e um **item** é uma coluna de uma pasta.

## Pode / Não pode

| Pode | Não pode |
|---|---|
| Ver todos os mapas, incluindo os privados | Alterar um mapa de que não é proprietário, exceto se for partilhado consigo como **Pode editar** |
| Executar, exportar e agendar todos os mapas (as regras de dados abaixo continuam a aplicar-se) | Eliminar um mapa de que não é proprietário |
| Partilhar qualquer mapa, e alterar ou remover qualquer partilha | Ver o texto SQL ou o plano da base de dados de uma execução |
| Copiar qualquer mapa para fazer a sua própria versão | Criar, eliminar ou alterar permissões em áreas de negócio |
| Entregar um mapa a outro proprietário | Criar, editar ou eliminar utilizadores |
| Abrir a página Utilizadores e ver que mapas cada pessoa pode abrir | Criar, editar ou eliminar origens de dados, nem importar tabelas de uma |
| Criar, editar e eliminar funções personalizadas | Ver as execuções, exportações ou agendamentos de outras pessoas |
| Testar e ler origens de dados | Usar Segurança, Registo de Auditoria ou Migração (só administradores) |
| Criar mapas nas áreas de negócio em que tem uma permissão | Alterar áreas de negócio, pastas, itens, junções ou hierarquias, qualquer que seja a permissão que tenha |

> **Nota:** **Áreas de Negócio**, **Pastas**, **Itens**, **Junções**, **Hierarquias**, **Segurança**, **Registo de Auditoria** e **Migração** são só para administradores. Não aparecem na sua barra lateral.

## De onde vem o seu acesso

Três coisas decidem o que pode fazer.

- **A sua função.** Como Manager, pode ver, executar, exportar, agendar e partilhar todos os mapas. Isto não depende de partilhas.
- **Partilhas.** Só pode alterar um mapa se for o proprietário ou se alguém o partilhou consigo como **Pode editar**. Ser Manager não acrescenta esse direito.
- **Permissões de área de negócio.** Um administrador dá-lhe uma permissão numa área de negócio. Uma permissão tem um nível. Cada nível inclui os anteriores.

| Nível de permissão | O que lhe permite fazer nessa área de negócio |
|---|---|
| VIEW | Ler os seus dados. Usar as suas pastas e itens no construtor de mapas. |
| EXPORT | Igual a VIEW. Os direitos de exportar e agendar num mapa vêm da forma como o mapa é partilhado. |
| SCHEDULE | Igual a VIEW. Os direitos de exportar e agendar num mapa vêm da forma como o mapa é partilhado. |
| CREATE | Tudo o que está em VIEW, mais criar mapas novos. |
| EDIT | Igual a CREATE para si. Os direitos de modelo adicionais deste nível são só para administradores. |
| DELETE | Igual a CREATE para si. Os direitos de modelo adicionais deste nível são só para administradores. |

Ao contrário de um administrador, não tem nenhuma exceção. Daqui resultam duas regras.

- Pode ver e executar todos os mapas, mas os dados vêm em segundo lugar. Uma execução ou exportação precisa de uma permissão em cada pasta que o mapa usa. Sem ela, a execução falha com **Sem autorização para executar**. Peça a permissão a um administrador.
- Uma permissão não faz os mapas aparecerem. Já vê todos os mapas porque é um Manager.

## Como iniciar sessão, alterar a palavra-passe e terminar sessão

1. Abra o endereço do Discoverer Neo no seu navegador.
2. Escreva o seu **Email** e a sua **Palavra-passe**.
3. Deixe **Manter sessão iniciada** assinalado para continuar com a sessão iniciada depois de fechar o navegador. Desmarque-o num computador partilhado. Assim, a sessão termina quando fechar o navegador.
4. Clique em **Iniciar sessão**. Chega ao **Painel**.

![A página de início de sessão com Email, Palavra-passe, Manter sessão iniciada e o botão Iniciar sessão.](shots/pt-PT/common/01-login.png)

Se escrever uma palavra-passe errada cinco vezes, a conta fica bloqueada durante 15 minutos. Aguarde e tente novamente. Não existe uma ligação "esqueci-me da palavra-passe". Peça a um administrador que a reponha.

Se a sua conta tiver uma palavra-passe temporária, o Discoverer Neo envia-o para **Alterar a palavra-passe** e nada mais funciona até a concluir.

Para alterar a palavra-passe em qualquer altura, abra o endereço `/change-password` na mesma janela do navegador. Introduza a palavra-passe atual e depois a nova, duas vezes. A nova tem de ter pelo menos 12 caracteres e ser diferente da anterior.

Para terminar a sessão, clique no seu nome no canto superior direito e escolha **Terminar sessão**. Isto termina a sua sessão. Para voltar a usar o Discoverer Neo, inicie sessão novamente.

![O menu da conta aberto, com Definições e Terminar sessão.](shots/pt-PT/common/03-user-menu.png)

---

# Painel

O **Painel** é a primeira página que vê. Só lhe dá números. Nada nele altera dados.

![O painel do Manager com a barra lateral e os cartões de resumo.](shots/pt-PT/manager/01-dashboard-sidebar.png)

| Cartão | O que mostra para si |
|---|---|
| **Total de Mapas** | Todos os mapas ativos do sistema. A linha por baixo divide-os em "seus" e "partilhados consigo". Para si, "partilhados consigo" significa os mapas de todas as outras pessoas, incluindo os privados. |
| **Total de Execuções** | Todas as execuções registadas, feitas por qualquer pessoa, dos mapas que pode ver. |
| **Mapas Agendados** | Mapas que têm pelo menos um agendamento ativo feito por si. |
| **Resultados Agendados** | Resultados guardados pelos seus próprios agendamentos. |
| **Mapas Recentes** | Os últimos cinco mapas que criou. Clique num para o abrir no construtor. |

A ligação **Ver agendamentos** em dois cartões abre a página **Agendamentos**.

---

# Funções Personalizadas

Uma função personalizada é uma função guardada na base de dados Oracle que os itens calculados podem chamar. Tem todos os direitos aqui. Não é preciso nenhuma permissão de área de negócio.

![A página Funções Personalizadas com a lista, Atualizar tudo e Nova Função.](shots/pt-PT/manager/08-custom-functions.png)

| Botão ou controlo | O que faz |
|---|---|
| **Filtrar por nome ou função da base de dados…** | Reduz a lista à medida que escreve. |
| **Atualizar tudo** | Volta a ler todas as funções do Oracle. As assinaturas alteradas são guardadas e os campos calculados são recompilados. As funções que já não existem no Oracle são mantidas e listadas. |
| **Nova Função** | Abre a caixa de diálogo da função. |
| Ícone da linha **Atualizar a partir da base de dados** | Atualiza uma função. |
| Ícone da linha **Editar** | Altera a função. |
| Ícone da linha **Eliminar** | Desativa a função depois de confirmar. |
| **Fechar** por baixo de **Resultado da atualização** | Esconde a lista de resultados. |

| Campo | O que significa |
|---|---|
| **Origem de dados** | A base de dados onde a função existe. |
| **Proprietário**, **Procurar uma função**, **Procurar** | Procura funções e packages no Oracle. Só origens de dados Oracle. |
| **Proprietário**, **Package**, **Nome da função**, **Database link** | As partes do nome completo. Apenas letras, dígitos, _, $ ou #, começando por uma letra. |
| **Nome** e **Descrição** | O nome a apresentar e uma nota. |
| **Tipo de Função** | Veja abaixo. |
| **Tipo de Retorno** | Por exemplo NUMBER. |
| **Parâmetros (JSON)** | A lista de entradas. Cada uma precisa de um nome e de um tipo. |

| Opção (**Tipo de Função**) | O que significa |
|---|---|
| SQL | Uma função SQL simples. |
| PLSQL | Uma função PL/SQL guardada. A predefinida. |
| PACKAGE | Uma função dentro de um package Oracle. |

## Exemplo: registar uma função de um package

1. Clique em **Funções Personalizadas** e depois em **Nova Função**.
2. Escolha a **Origem de dados**.
3. Escreva parte do nome em **Procurar uma função** e clique em **Procurar**.
4. Clique no resultado certo. O tipo, o proprietário, o package, o tipo de retorno e os parâmetros ficam preenchidos. Os resultados que o Oracle não consegue chamar a partir de SQL aparecem a cinzento.
5. Verifique o **Nome** e clique em **Guardar**.

---

# Origens de Dados

Uma origem de dados é uma ligação guardada a uma base de dados. Pode consultá-las e testá-las. Não as pode alterar.

![A página Origens de Dados com a lista de ligações e os ícones de linha.](shots/pt-PT/manager/07-data-sources.png)

| Botão ou controlo | O que faz |
|---|---|
| Ícone da linha **Testar ligação** | Experimenta o início de sessão guardado. Uma mensagem diz **Ligação bem-sucedida** ou **Falha na ligação**. |
| Ícone da linha **Introspetar esquema** | Lê o esquema Oracle para encontrar as suas tabelas. Mostra quantas tabelas foram encontradas. Só Oracle. |
| **Nova Origem de Dados** | Reservado aos administradores. |
| Ícone da linha **Editar** | Reservado aos administradores. |
| Ícone da linha **Eliminar** | Reservado aos administradores. |
| Ícone da linha **Importar tabelas** | Pode abrir a caixa de diálogo e usar **Descobrir Tabelas**. **Importar** é reservado aos administradores. |

> **Nota:** O ecrã oferece **Nova Origem de Dados**, **Editar**, **Eliminar** e o passo de importação. O sistema recusa-os para si. Para criar pastas a partir de tabelas, use antes **Pastas** e **Descobrir Tabelas**.

---

# Utilizadores

A página **Utilizadores** é só de leitura para si. Use-a para ver contas, para descobrir que mapas uma pessoa pode abrir e para corrigir quem é o proprietário ou partilha um mapa.

![A lista de Utilizadores só de leitura, sem os botões Novo Utilizador nem Ficheiro de credenciais.](shots/pt-PT/manager/06-users.png)

A lista mostra **Nome**, **Email**, **Função** e **Estado** (**Ativo** ou **Inativo**). Não pode criar, editar, desativar, ativar nem eliminar utilizadores. Não pode emitir um ficheiro de credenciais. Fale com um administrador.

## Mapas de uma pessoa

Clique no ícone da linha **Mapas que este utilizador pode abrir**. A caixa de diálogo **Mapas de {name}** lista todos os mapas que essa pessoa vê.

![A caixa de diálogo Mapas de um utilizador, com listas de nível de partilha e ícones de proprietário e remover.](shots/pt-PT/manager/11-users-maps-dialog.png)

| Botão ou controlo | O que faz |
|---|---|
| Nome do mapa | Abre o mapa no visualizador. |
| **Proprietário: {name}** | Mostra quem é o proprietário do mapa. |
| Etiqueta | Diz porque é que a pessoa vê o mapa. |
| Seletor do nível de partilha | Altera o que a pessoa pode fazer com um mapa partilhado. |
| Ícone de proprietário | Abre a lista **Novo proprietário**. |
| **Novo proprietário** | Escolha uma pessoa a quem dar o mapa. |
| Ícone de remover (X) | Remove o mapa dessa pessoa. Sem confirmação. |

| Opção (etiqueta) | O que significa |
|---|---|
| Administrador | A pessoa é administradora e vê todos os mapas. |
| Proprietário | A pessoa é proprietária do mapa. |
| Partilhado | Alguém partilhou o mapa com a pessoa. Pode alterar ou remover isto. |
| Público | O mapa é público. |
| Função de gestor | A pessoa é gestora e vê todos os mapas. |

| Opção (nível de partilha) | O que significa / quando escolher |
|---|---|
| Pode ver | Pode abrir e executar o mapa. Não pode exportá-lo, agendá-lo nem alterá-lo. |
| Pode exportar | Pode abrir e executar o mapa, exportar o resultado e pô-lo num agendamento. |
| Pode editar | Pode fazer tudo o que foi dito acima e também alterar o mapa. |

## Exemplo: dar um mapa a um colega que assume o trabalho

1. Clique em **Utilizadores** e depois no ícone da linha **Mapas que este utilizador pode abrir** do proprietário atual.
2. Encontre o mapa. Clique no ícone de proprietário.
3. Em **Novo proprietário**, escolha o colega.
4. Aguarde pela mensagem **Proprietário alterado**.

> **Atenção:** O novo proprietário pode alterar, partilhar e eliminar o mapa. A partilha anterior que ele tinha do mapa é descartada. Não passa a ser editor do mapa por o entregar.

---

# Mapas

A página **Mapas** lista todos os mapas do sistema. Vê tudo, incluindo os mapas privados. Ver um mapa não significa que possa ler os respetivos dados. As regras de dados do primeiro capítulo continuam a aplicar-se.

![A lista de Mapas, separador Todos, com os ícones Copiar, Partilhar, Agendar e Exportar em cada linha.](shots/pt-PT/manager/02-maps-all.png)

## Encontrar um mapa

| Controlo | O que faz |
|---|---|
| Separador **Meus** | Mapas que criou. |
| Separador **Partilhado comigo** | Mapas que alguém partilhou consigo, com qualquer nível. |
| Separador **Todos** | Todos os mapas do sistema. |
| **Procurar mapas por nome…** | Filtra por nome. |
| Filtro **Área de Negócio** | Mostra uma área de negócio. Escolha **Todas as áreas de negócio** para repor. |
| **Ordenar por** | **Recentemente atualizado** ou **Nome (A–Z)**. |
| **Limpar** | Repõe a pesquisa e o filtro. |

A secção **Pastas de trabalho** no topo agrupa os mapas por livro. Clique num livro para ver os seus mapas. Clique num mapa para o abrir.

## O que faz cada ícone

| Ícone | O que faz |
|---|---|
| Olho | Abre o visualizador para poder executar o mapa. |
| Lápis | Abre o construtor. Só aparece em mapas de que é proprietário, ou que são partilhados consigo como **Pode editar**. |
| Copiar | Faz a sua própria cópia, que pode depois alterar. Funciona para qualquer mapa. |
| Partilhar | Abre **Partilhar mapa**. Funciona para qualquer mapa. |
| Calendário | Abre **Agendamentos** com este mapa escolhido. |
| Transferir | Abre o visualizador, onde exporta. |
| Lixo | Elimina o mapa. Só aparece nos seus próprios mapas. |

A linha do livro tem os seus próprios ícones. Copiar faz uma cópia privada de todos os mapas do livro. Partilhar dá a alguém todos os mapas do livro. O lixo só elimina um livro se for proprietário de todos os mapas que ele contém.

> **Atenção:** Um mapa eliminado só pode ser reposto por um administrador.

## Copiar um mapa para construir o seu

1. Encontre o mapa e clique no ícone Copiar.
2. Para um livro, escreva um nome em **Nome do novo livro** e clique em **Copiar**.
3. A cópia abre-se no construtor. É privada, só sua.

Exemplo: copie **GD_M.M10_V01.DIS** e depois adicione uma coluna à sua cópia. O original não muda.

## Partilhar um mapa

1. Clique no ícone Partilhar no mapa.
2. Procure uma pessoa pelo nome ou e-mail.
3. Clique num nível junto ao nome dessa pessoa: **Pode ver**, **Pode exportar** ou **Pode editar**. O botão escuro é o que ela tem agora.
4. Para retirar o acesso, clique no X junto ao nome.

![A caixa de diálogo Partilhar mapa com uma caixa de pesquisa e os botões Pode ver, Pode exportar e Pode editar.](shots/pt-PT/manager/03-share-dialog.png)

A caixa de diálogo também mostra um aviso quando o mapa é público, com **Copiar ligação**. Qualquer pessoa com a ligação pode vê-lo. Esta caixa de diálogo não alterna um mapa entre público e privado. Essa opção está no separador **Propriedades** do mapa, e só quem pode editar o mapa a pode guardar.

Para um livro, a mesma caixa de diálogo distribui uma partilha por todos os mapas que consegue ver nele. Diz-lhe que mapas não puderam ser partilhados.

---

# Construtor de mapas

Use o construtor para criar um mapa ou alterar um. Chega lá com **Criar Mapa**, com o ícone do lápis, ou copiando um mapa.

![O construtor de mapas com a árvore Áreas de Negócio, a área de Colunas e o painel Propriedades.](shots/pt-PT/user/05-builder-overview.png)

## O que pode guardar

| Situação | Pode guardar? |
|---|---|
| Um mapa novo | Sim, se tiver uma permissão CREATE ou superior na área de negócio. |
| Um mapa de que é proprietário | Sim. |
| Um mapa partilhado consigo como **Pode editar** | Sim. |
| Qualquer outro mapa | Não. Guardar falha com "Forbidden". Copie primeiro o mapa e depois edite a sua cópia. |

O construtor abre-se para todos os mapas, mesmo para um que não possa guardar. Só o descobre quando clica em **Guardar**.

## A barra de ferramentas

| Botão ou controlo | O que faz |
|---|---|
| **Voltar** | Regressa à página de onde veio. As alterações não guardadas perdem-se sem aviso. |
| Caixa do nome do mapa | Define o nome do mapa. |
| Lista do tipo de mapa | **Tabela**, **Tabela Cruzada**, **Página-Detalhe** ou **Gráfico**. Só **Tabela Cruzada** muda o aspeto do resultado. Os outros aparecem como uma tabela simples. |
| **● Não guardado** | Lembra-o de que tem alterações que não guardou. |
| **Executar** | Guarda o mapa se for novo ou tiver sido alterado e depois executa-o. |
| **Guardar** | Guarda as suas alterações. Nada é guardado automaticamente. |
| **Exportar** > **Definição do mapa (.xml)** | Transfere a definição do mapa. Não contém linhas de dados. Precisa de um mapa guardado. |
| **Agendar** | Abre **Agendamentos** com este mapa escolhido. Precisa de um mapa guardado. |
| **Formatação** | Abre a formatação condicional. Precisa de um mapa guardado. |
| **Partilhar** | Abre **Partilhar mapa**. Precisa de um mapa guardado. |

## Construir um mapa

1. Na árvore **Áreas de Negócio** à esquerda, abra uma área de negócio e uma pasta. Só são listadas as áreas em que tem uma permissão.
2. Arraste itens para a área **Colunas**, ou clique no botão de mais junto a um item. As medidas têm um ícone de sigma, as dimensões um ícone de etiqueta.
3. Todas as colunas de um mapa têm de vir de uma só área de negócio. A primeira coluna que adiciona decide qual.
4. Clique numa coluna para abrir **Configurar coluna**. Altere o que precisar e clique em **Guardar** nessa caixa de diálogo.
5. Adicione condições, ordenação e parâmetros nos separadores do lado direito.
6. Clique em **Guardar** na barra de ferramentas. Depois clique em **Executar**.

Use **Filtrar itens…** por cima da árvore para encontrar um item pelo nome.

## Configurar coluna

| Campo | O que faz |
|---|---|
| **Nome a apresentar** | Título da coluna. Em branco usa o nome do item. |
| **Agregação** | Total desta coluna. |
| **Direção de ordenação** | **Nenhum**, **Ascendente** ou **Descendente**. |
| **Máscara de formato** | Como os números e as datas aparecem. **Predefinições** preenche-a por si. |
| **Ordem de ordenação** | Posição desta coluna quando ordena por várias. |
| **Largura da coluna (px)** | Largura em píxeis. |
| **Colocação** | Veja abaixo. |
| **Margem da tabela cruzada** | Onde vai uma coluna de eixo numa tabela cruzada. |
| **Agrupar e quebrar** | Esconde valores repetidos e inicia um subtotal quando o valor muda. |
| **Só na consulta, não mostrar** | A consulta usa a coluna, mas o resultado esconde-a. |

| Opção (**Colocação**) | O que significa |
|---|---|
| Nenhum | Sem papel especial. |
| Agrupar por (eixo) | A coluna agrupa as linhas. |
| Medida | A coluna contém um valor que é totalizado. |
| Item de página | A coluna torna-se um filtro de página. |

| Opção (**Margem da tabela cruzada**) | O que significa |
|---|---|
| Nenhum | Não é usada numa tabela cruzada. |
| Ao lado | Os valores correm ao longo do lado esquerdo. |
| No topo | Os valores correm ao longo do topo. |

| Opção (**Predefinições**) | O que preenche |
|---|---|
| Número (1.234) | 999,999,999 |
| Decimal (1.234,00) | 999,999,999.00 |
| Moeda (1.234,00 €) | $999,999,999.00 |
| Percentagem (12,3%) | 990.0% |
| Data (DD-MON-YYYY) | DD-MON-YYYY |
| Data (YYYY-MM-DD) | YYYY-MM-DD |

## Os cinco separadores de definições

| Separador | Para que serve |
|---|---|
| **Propriedades** | A **Descrição** impressa por cima dos resultados e em todas as exportações, a caixa **Público (visível para todos na área de negócio)** e as contagens. **Inserir variável** acrescenta valores como a data da execução. |
| **Condições** | Filtros. |
| **Ordenação** | Níveis de ordenação. |
| **Parâmetros** | Perguntas feitas quando o mapa é executado. |
| **Campos Calculados** | Colunas novas a partir de uma fórmula. |

> **Atenção:** **Público** torna o mapa visível e exportável por todas as pessoas com sessão iniciada, e não apenas pelas pessoas da área de negócio. Os direitos de dados delas continuam a aplicar-se.

**Condições.** Clique em **Adicionar Condição**. Escolha o **Item da condição**, um **Operador** e um valor. Escolha **Valor estático** para um valor fixo, ou **Pedir em tempo de execução** para perguntar de cada vez. Para um pedido, dê ao parâmetro um nome que tenha definido no separador **Parâmetros**. Selecione duas ou mais condições e clique em **Agrupar** para as unir com OR. Use **Desagrupar** para anular.

| Opção (**Operador**) | O que significa |
|---|---|
| = | Igual a. |
| <> | Diferente de. |
| < e > | Menor que, maior que. |
| <= e >= | Menor ou igual, maior ou igual. |
| LIKE | Corresponde a um padrão com % e _. |
| IN | Corresponde a qualquer valor de uma lista, separados por vírgulas. |
| BETWEEN | Entre dois valores, primeiro o menor e depois o maior. |
| IS NULL | O valor está vazio. |

**Ordenação.** Escolha uma coluna, clique em **Adicionar ordenação** e depois escolha **Ascendente** ou **Descendente**. Arraste um nível para mudar a sua prioridade.

**Parâmetros.** Clique em **Adicionar Parâmetro**. Dê-lhe um nome único, um tipo e, se quiser, um valor predefinido. Assinale **Obrigatório** para recusar uma resposta em branco. Se todos os parâmetros tiverem um valor predefinido, **Executar** ignora a pergunta.

| Opção (tipo de parâmetro) | O que significa |
|---|---|
| STRING | Texto. |
| NUMBER | Um número. |
| DATE | Uma data. |
| LIST | Vários valores separados por vírgulas. |

**Campos Calculados.** Clique em **Adicionar Campo Calculado**, dê-lhe um nome e clique no botão da fórmula. No **Editor de fórmulas**, escreva uma fórmula ou clique nos botões de funções e colunas para os inserir. **Testar fórmula** executa-a nas primeiras cinco linhas de um mapa guardado. Precisa de uma permissão sobre os dados.

## Formatação condicional

Clique em **Formatação** para colorir células ou linhas inteiras segundo uma regra, por exemplo a vermelho quando um valor é inferior a zero. As regras são guardadas de imediato e não fazem parte de **Guardar**. Tem de ser o proprietário do mapa ou ter **Pode editar** nele para adicionar ou eliminar regras. Caso contrário, o sistema recusa com "Forbidden".

| Campo | O que significa |
|---|---|
| **Coluna** | A coluna a testar. |
| **Aplicar a** | **Célula** ou **Linha**. |
| **Operador** | **Igual a**, **Diferente de**, **Maior que**, **Menor que**, **Maior ou igual a**, **Menor ou igual a**, **Contém (caracteres % e _)**, **Na lista**, **Entre** ou **Está vazio**. |
| **Valor** | Com o que comparar. Escondido para **Está vazio**. |
| **Cor de fundo**, **Cor do texto** | Cores. **Limpar** remove uma. |
| **Negrito**, **Itálico**, **Sublinhado** | Estilo do texto. |

## Mapas recusados

Algumas formas de mapa são recusadas antes de serem executadas, por exemplo pastas sem junção, ou totais que seriam contados duas vezes. Uma caixa âmbar explica porquê e o que mudar. Adicione uma junção, remova colunas, ou divida o mapa em dois.

---

# Visualizador de mapas

O visualizador executa um mapa e mostra as respetivas linhas. Nunca altera o mapa. Chega lá com o ícone do olho, ou a partir de **Execuções** e **Exportações**.

![Uma execução concluída com os botões Excel, CSV e PDF por cima da grelha de resultados.](shots/pt-PT/viewer/06-viewer-results.png)

| Botão ou controlo | O que faz |
|---|---|
| **Executar** | Executa o mapa. Se um parâmetro não tiver valor predefinido, os **Parâmetros de execução** abrem-se primeiro. |
| **Executar novamente** | Depois de uma execução terminada, pede uma execução nova com os mesmos valores. |
| **Cancelar** | Cancela uma execução que ainda está à espera na fila. Uma execução já em curso não pode ser cancelada aqui. |
| **Gestão de agendamentos** | Abre **Agendamentos**. |
| **Excel**, **CSV**, **PDF** | Exportam o resultado terminado. |
| **Carregar mais** | Carrega as 500 linhas seguintes. |
| Clique num cabeçalho | Ordena por essa coluna. |
| **Filtrar…** por baixo de um cabeçalho | Filtra as linhas já carregadas. |
| Duplo clique numa linha | Abre **Ver Detalhe**, as linhas de origem por trás dessa linha. |

A linha de estado por baixo de **Executar** diz se o resultado é novo ou foi reutilizado. Um resultado mantém-se válido durante 24 horas. Se executar o mesmo mapa com os mesmos valores nesse período, obtém o resultado guardado. Use **Executar novamente** para forçar um novo.

**Executar** e **Exportar** precisam de uma permissão em cada pasta do mapa. Sem ela, aparece uma caixa vermelha **Sem autorização para executar**. Peça a permissão a um administrador.

Não vê os botões **SQL** e **Plano**. São para administradores.

A caixa de diálogo **Parâmetros de execução** faz uma pergunta por parâmetro. Uma estrela vermelha marca uma obrigatória. Quando o parâmetro alimenta um filtro num item, um seletor sugere os valores reais. Precisa de uma permissão nessa área.

## Exportar para PDF

Clique em **PDF** para abrir **Exportar para PDF**.

| Campo | O que significa |
|---|---|
| **Tamanho do papel** | **A4**, **A3** ou **Carta**. |
| **Orientação** | **Vertical** ou **Horizontal**. |
| **Colunas** | Assinale as colunas a imprimir. **Selecionar todas** e **Limpar** alternam todas. |

Clique em **Exportar**. A descrição do mapa é impressa no topo da primeira página.

## Exemplo: executar e exportar GD_M.M10_V01.DIS

1. Abra **Mapas**, encontre **GD_M.M10_V01.DIS** e clique no ícone do olho.
2. Clique em **Executar**. Responda às perguntas, se aparecerem.
3. Quando as linhas aparecerem, clique em **Excel**.
4. Abra **Exportações** para transferir o ficheiro.

---

# Agendamentos

Um agendamento executa um mapa automaticamente num horário e guarda o resultado. Só vê os seus próprios agendamentos, embora possa agendar qualquer mapa.

![A página Agendamentos com um agendamento em pausa e os respetivos ícones de ação.](shots/pt-PT/user/38-schedules-list.png)

Para agendar um mapa de que não é proprietário, use o ícone do calendário na página **Mapas**. A lista de mapas na caixa de diálogo **Novo Agendamento** contém apenas os seus próprios mapas e os mapas partilhados consigo.

Um agendamento é executado como si. As suas permissões de área de negócio decidem se ele pode ler os dados.

| Botão ou controlo | O que faz |
|---|---|
| **Novo Agendamento** | Abre a caixa de diálogo. |
| Ícone da linha **Executar agora** | Executa-o de imediato. Não disponível enquanto está em pausa. |
| Ícone da linha **Pausar** ou **Ativar** | Desliga ou liga o agendamento. |
| Ícone da linha **Histórico** | Abre o **Histórico de Execuções**. |
| Ícone da linha **Editar** | Altera o agendamento. Não pode alterar o respetivo mapa. |
| Ícone da linha **Eliminar** | Elimina o agendamento e o respetivo histórico depois de confirmar. Não pode ser anulado. |

A coluna **Estado** mostra **Ativo** ou **Em pausa**. A coluna **Planeador** é preenchida pela migração. Não a pode alterar.

| Campo na caixa de diálogo | O que significa |
|---|---|
| **Mapa** | O mapa a executar. |
| **Nome** | O nome do agendamento. |
| **Frequência** | Veja abaixo. |
| **Fuso horário** | O relógio que as horas usam. Por predefinição, UTC. |
| **Expressão cron** | Mostrada para **Personalizado**. Cinco campos: minuto, hora, dia do mês, mês, dia da semana. |
| **Válido a partir de** e **Válido até** | Datas opcionais. O agendamento só é executado entre elas. |
| **Formato de Saída** | Veja abaixo. |
| **Predefinições de parâmetros** | O valor usado de cada vez para cada parâmetro do mapa. |
| **Ativado** | Desativado significa que nunca é executado sozinho. |

| Opção (**Frequência**) | O que significa |
|---|---|
| Diariamente (meia-noite) | Todos os dias às 00:00. |
| Semanalmente (domingo, meia-noite) | Todos os domingos às 00:00. |
| Mensalmente (dia 1, meia-noite) | No primeiro dia de cada mês às 00:00. |
| Personalizado | Escreve a expressão cron. Exemplo: `0 9 * * 1-5` é às 09:00 nos dias úteis. |

| Opção (**Formato de Saída**) | O que significa |
|---|---|
| Excel (.xlsx) | Uma folha de cálculo. |
| CSV | Uma tabela em texto simples. A predefinida. |

O **Histórico de Execuções** lista os últimos 50 resultados com **Executado**, **Estado**, **Linhas** e **Duração**. Cada um tem os botões **XLSX**, **CSV** e **PDF** e um ícone **Abrir**. Os resultados são mantidos durante 30 dias. Depois, os botões de exportação desaparecem.

## Exemplo: agendar uma execução semanal

1. Em **Mapas**, clique no ícone do calendário do mapa.
2. Escreva um **Nome**. Defina a **Frequência** como **Semanalmente (domingo, meia-noite)**.
3. Escolha o seu **Fuso horário** e o **Formato de Saída**.
4. Clique em **Guardar**.
5. Clique no ícone **Executar agora** para verificar que funciona. Depois abra **Histórico**.

---

# Execuções

**Execuções** lista todas as execuções que pediu, quer estejam em espera, em curso ou terminadas. Mostra apenas as suas próprias execuções, não as de outras pessoas.

![A página Execuções com os filtros Mapa, Estado e Tipo e a lista de execuções.](shots/pt-PT/manager/10-runs.png)

| Botão ou controlo | O que faz |
|---|---|
| Filtros **Mapa**, **Estado**, **Tipo** | Reduzem a lista. **Tipo** é **Em direto** ou **Agendada**. |
| Nome do mapa | Abre o visualizador. |
| Ícone **Abrir** | Abre o resultado guardado dessa execução. |
| Ícone **Executar novamente** | Pede a mesma execução outra vez. |
| **XLSX**, **CSV**, **PDF** | Exportam uma execução terminada que não expirou. |
| Ícone **Cancelar** | Cancela uma execução que ainda está em fila. |
| Ícone **Eliminar** | Elimina uma execução terminada e as respetivas linhas guardadas. Não pode ser anulado. |

A coluna **Expira em** mostra durante quanto tempo o resultado é mantido. A caixa **Mostrar execuções de todos os utilizadores** é só para administradores, por isso não a vê. Uma execução de um mapa que já não pode abrir desaparece da sua lista.

---

# Exportações

**Exportações** lista os ficheiros que pediu. Só vê os seus.

![A página Exportações com a lista de exportações e um botão Transferir nas concluídas.](shots/pt-PT/user/44-exports.png)

| Botão ou controlo | O que faz |
|---|---|
| Ícone **Transferir** | Transfere um ficheiro terminado. |

O **Estado** mostra **Em fila**, **Em execução**, **Concluída** ou **Falhada**. Aponte para um estado de falha para ler o motivo. Os ficheiros são mantidos durante 7 dias. Depois disso, a transferência falha. Exporte novamente a partir de uma execução nova.

---

# Definições

Abra as **Definições** na barra lateral ou no menu do seu nome. As escolhas ficam guardadas para a sua conta em todos os computadores, mas só depois de clicar em **Guardar**.

![A página Definições com os cartões Idioma de exibição, Aparência e Paleta.](shots/pt-PT/common/04-settings.png)

| Controlo | O que faz |
|---|---|
| **Idioma de exibição** | **English**, **Português (Portugal)**, **Français (France)** ou **Español (España)**. |
| **Aparência** | **Claro**, **Escuro** ou **Alto contraste**. |
| **Paleta** | **Clássica**, **Azul-marinho**, **Floresta**, **Vinho**, **Oceano** ou **Ocre**. Desativada enquanto **Alto contraste** estiver ativo. |
| **Guardar** | Guarda as suas escolhas. |

Se sair sem guardar, este navegador mostra a nova escolha, mas a sua conta continua com a antiga.

---

# Perguntas frequentes

**Porque vejo um mapa mas a execução diz "Sem autorização para executar"?**
Como Manager, vê todos os mapas. Os dados dele precisam de uma permissão de área de negócio em cada pasta que ele usa. Fale com um administrador.

**Porque não há um ícone de lápis num mapa?**
Só pode editar os seus próprios mapas e os mapas partilhados consigo como **Pode editar**. Clique no ícone Copiar e altere a sua cópia. Ou peça ao proprietário que o partilhe consigo como **Pode editar**.

**Onde estão Áreas de Negócio, Pastas, Itens, Junções e Hierarquias?**
Alterar o modelo de dados é só para administradores, por isso estas páginas não aparecem na sua barra lateral. Se uma pasta ou um item estiver errado ou em falta, peça a um administrador.

**Cliquei em algo e apareceu "Forbidden" ou "Falha ao guardar".**
O ecrã ofereceu essa opção, mas a sua função ou permissão não a permite. O caso mais comum é guardar um mapa de que não é proprietário.

**Não consigo ver as execuções, exportações ou agendamentos de outra pessoa.**
As execuções, exportações e agendamentos pertencem a quem os fez. Ninguém além dessa pessoa os vê na lista, e o mesmo vale para si.

**Um colega saiu. Como mantenho os mapas dele?**
Abra **Utilizadores**, clique em **Mapas que este utilizador pode abrir** e use o ícone de proprietário em cada mapa para o dar a outra pessoa.

**Um agendamento que fiz não é executado.**
Verifique se o seu **Estado** é **Ativo**, se as datas em **Válido a partir de** e **Válido até** cobrem o dia de hoje e se ainda tem uma permissão sobre os dados. Um agendamento é executado como si.

**A transferência da minha exportação diz que falhou.**
Os ficheiros são mantidos durante 7 dias. Execute o mapa novamente e exporte o novo resultado.

**Não consigo alterar a palavra-passe quando me esqueço dela.**
Não existe ligação de recuperação. Fale com um administrador.

---

# Glossário

| Termo | Significado |
|---|---|
| Mapa | Um relatório. No Oracle Discoverer era uma folha de cálculo. |
| Livro | Um grupo de mapas. |
| Área de negócio | Um grupo de dados relacionados. |
| Pasta | Uma tabela, vista ou consulta dentro de uma área de negócio. |
| Item | Uma coluna de uma pasta. Uma dimensão agrupa linhas. Uma medida contém valores que são totalizados. |
| Junção | A regra que liga duas pastas. |
| Hierarquia | Uma lista ordenada de itens para aprofundamento. |
| Permissão | Acesso a uma área de negócio dado por um administrador, com um nível. |
| Partilha | Acesso a um mapa dado a uma pessoa, com um nível: **Pode ver**, **Pode exportar** ou **Pode editar**. |
| Mapa público | Um mapa que qualquer pessoa com sessão iniciada pode ver e exportar. Os direitos de dados dela continuam a aplicar-se. |
| Execução | Uma execução de um mapa. As suas linhas são guardadas durante 24 horas. |
| Exportação | Um ficheiro (Excel, CSV ou PDF) feito a partir de uma execução terminada. |
| Agendamento | Um horário que executa um mapa automaticamente e guarda o resultado. |
| Origem de dados | Uma ligação guardada a uma base de dados. |
| Função personalizada | Uma função da base de dados que os itens calculados podem chamar. |
