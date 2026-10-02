# A sua função numa página

É um **administrador**. Pode usar todas as páginas. Um **mapa** é um relatório (no Oracle Discoverer, uma folha de cálculo). Uma **área de negócio** é um grupo de dados relacionados.

| Pode | Não pode |
|---|---|
| Abrir, alterar, partilhar, copiar e eliminar todos os mapas | Eliminar ou desativar a sua própria conta |
| Construir mapas em qualquer lado, sem permissão | Transferir a exportação de outro utilizador |
| Ver o SQL e o plano de um mapa | Ver na lista os agendamentos de outros utilizadores |
| Ver as execuções de todos os utilizadores | |
| Configurar áreas de negócio, pastas, itens, junções, hierarquias, funções, origens de dados | |
| Gerir utilizadores, permissões, políticas de segurança | |
| Ler o registo de auditoria e executar migrações | |

**Iniciar sessão:** escreva o **Email** e a **Palavra-passe** e clique em **Iniciar sessão**. Termine a sessão no menu do seu nome com **Terminar sessão**. As **Definições** (idioma, tema, paleta) precisam de **Guardar** para ficarem gravadas.

![A página de início de sessão com Email, Palavra-passe, Manter sessão iniciada e o botão Iniciar sessão.](shots/pt-PT/common/01-login.png)

---

# Painel e Mapas

O **Painel** conta os mapas, as execuções e os seus agendamentos. **Mapas** lista todos os mapas do sistema.

![A lista de Mapas, separador Todos, com todos os ícones de linha e a secção Pastas de trabalho por cima.](shots/pt-PT/admin/02-maps-all.png)

1. Abra **Mapas**. Use os separadores **Meus**, **Partilhado comigo**, **Todos**.
2. Encontre um mapa com a caixa de pesquisa ou com o filtro **Área de Negócio**.
3. Clique no ícone do olho para o executar e no lápis para o alterar.
4. Clique no ícone Partilhar para dar acesso.
5. Clique no ícone do lixo para eliminar (só um administrador o pode restaurar).

| Escolha | Significado |
|---|---|
| **Pode ver** | Só abrir e executar. |
| **Pode exportar** | Também exportar e agendar. |
| **Pode editar** | Também alterar o mapa. Não pode voltar a partilhar. |
| Ícone Copiar | A sua própria cópia privada. |

---

# Construtor e visualizador de mapas

O construtor cria um mapa. O visualizador executa-o.

![Os resultados da execução com os botões SQL e Plano junto aos botões Excel, CSV e PDF.](shots/pt-PT/admin/03-viewer-results.png)

1. Clique em **Criar Mapa**.
2. Arraste itens da árvore **Áreas de Negócio** para a área de trabalho. O primeiro item fixa a área de negócio.
3. Clique numa coluna para definir a **Agregação**, a ordenação ou o formato.
4. Se for preciso, adicione **Condições**, **Parâmetros** ou **Campos Calculados** nos separadores da direita.
5. Clique em **Guardar** e depois em **Executar**.
6. Exporte com **Excel**, **CSV** ou **PDF**. Também vê **SQL** e **Plano**.

| Escolha | Significado |
|---|---|
| **Público** (Propriedades) | Todos os utilizadores com sessão iniciada podem abri-lo e exportá-lo. |
| **Agregação** | NONE, SUM, COUNT, AVG, MIN, MAX. |
| **Executar novamente** (visualizador) | Nova execução, ignora o resultado guardado. |
| **PDF** | Escolha o papel (A4, A3, Carta) e a orientação. |

---

# Execuções, Exportações e Agendamentos

Uma **execução** é uma execução de um mapa (mantida 24 horas). Uma **exportação** é um ficheiro feito a partir de uma execução (mantido 7 dias). Um **agendamento** executa um mapa automaticamente.

![A página Execuções com as execuções de todos os utilizadores.](shots/pt-PT/admin/04-runs-every-user.png)

1. Em **Execuções**, assinale **Mostrar execuções de todos os utilizadores** para ver as de todos.
2. Clique em **Abrir** para ver um resultado, ou em **XLSX**, **CSV**, **PDF** para o exportar.
3. Em **Exportações**, clique no ícone Transferir. Só vê os seus próprios ficheiros.
4. Em **Agendamentos**, clique em **Novo Agendamento**. Escolha o mapa, a **Frequência**, o **Fuso horário** e o **Formato de Saída**. Clique em **Guardar**.
5. Use **Histórico** para abrir ou exportar resultados anteriores.

| Escolha | Significado |
|---|---|
| **Frequência** | **Diário**, **Semanal**, **Quinzenal**, **Mensal**, a cada 2, 3, 4 ou 6 meses, **Anual**, **Personalizado (cron)**. Depois uma **Hora** e um dia. |
| **Predefinições de parâmetros** | **Valor fixo**, ou **Relativo à data de execução** (por exemplo -1 **meses**, **último dia desse mês**). |
| **Formato de Saída** | **Excel (.xlsx)** ou **CSV**. |
| **Executar agora** | Executa um agendamento de imediato. |

---

# Áreas de Negócio e Permissões

Uma área de negócio agrupa pastas. Uma **permissão** dá a uma pessoa acesso aos respetivos dados. Uma permissão nunca mostra um mapa.

![A caixa de diálogo Gerir concessões com a lista Permissão aberta.](shots/pt-PT/admin/09-business-areas-grants-permission.png)

1. Abra **Áreas de Negócio**. Clique em **Nova Área de Negócio**, escreva um **Nome** e clique em **Guardar**.
2. Clique no ícone **Gerir concessões**.
3. Assinale as pessoas. Escolha a **Permissão**. Clique em **Adicionar**.
4. Clique em **Revogar** para retirar uma permissão.

| Nível | Significado |
|---|---|
| VIEW | Ler dados, executar mapas partilhados. |
| EXPORT, SCHEDULE | Igual a VIEW. Os direitos vêm da partilha do mapa. |
| CREATE | Também criar mapas, pastas, itens, junções, hierarquias. |
| EDIT | Também alterar a área e os respetivos objetos. |
| DELETE | Também eliminar esses objetos. |

Um Manager nunca altera o modelo. Para um Manager, CREATE e acima só lhe permitem criar mapas.

---

# Pastas, Itens, Junções, Hierarquias

Uma **pasta** é uma tabela ou vista. Um **item** é uma coluna. Uma **junção** liga duas pastas. Uma **hierarquia** é uma lista de aprofundamento.

![A caixa de diálogo Nova Pasta depois de Descobrir Tabelas, com a lista das tabelas encontradas.](shots/pt-PT/admin/14-folders-discovered.png)

1. Escolha uma área de negócio em **Pastas**. Clique em **Nova Pasta**.
2. Escolha a **Origem de Dados**, clique em **Descobrir Tabelas** e clique numa tabela.
3. Assinale as colunas a criar como itens. Clique em **Guardar**.
4. Em **Junções**, clique em **Nova Junção**. Escolha duas pastas, clique em **Sugerir Junções** e escolha um **Tipo de Junção**. Clique em **Guardar**.
5. Em **Hierarquias**, clique em **Nova Hierarquia** e adicione os níveis de cima para baixo. Clique em **Guardar**.
6. Use **Atualizar tudo** para voltar a ler as tabelas depois de a base de dados mudar.

| Escolha | Significado |
|---|---|
| **Tipo de Pasta** | TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY. |
| **Tipo de Junção** | INNER, LEFT, RIGHT. |
| **Tipo de Item** | Item de Base de Dados (CO), Item Criado (CI), Item Calculado (CU), Item de Junção (JI), Item de Hierarquia (HI), Agregação (AG), Função (FU). |

---

# Funções Personalizadas e Origens de Dados

Uma **origem de dados** é uma ligação guardada a uma base de dados. Uma **função personalizada** é uma função Oracle que os itens calculados podem chamar.

![A página Origens de Dados com uma tabela de ligações e cinco ícones de linha.](shots/pt-PT/admin/30-data-sources.png)

1. Em **Origens de Dados**, clique em **Nova Origem de Dados**. Preencha **Nome**, **Tipo de Ligação**, **Anfitrião**, **Porta**, **Nome de Utilizador**, **Palavra-passe**. Clique em **Guardar**.
2. Clique em **Testar ligação**.
3. Clique em **Importar tabelas** para criar muitas pastas de uma vez.
4. Em **Funções Personalizadas**, clique em **Nova Função**. Escolha a origem de dados, procure no Oracle e clique num resultado. Clique em **Guardar**.

| Escolha | Significado |
|---|---|
| **Tipo de Ligação** | **Oracle** ou **PostgreSQL**. |
| **Tipo de Função** | SQL, PLSQL, PACKAGE. |
| **Atualizar tudo** | Volta a ler as funções do Oracle. |

---

# Utilizadores

Adicione pessoas, defina funções, desligue contas, entregue mapas a outras pessoas.

![A página Utilizadores com os botões Ficheiro de credenciais e Novo Utilizador e os ícones de linha.](shots/pt-PT/admin/35-users.png)

1. Clique em **Novo Utilizador**. Escreva **Nome**, **Email**, **Palavra-passe** (8 ou mais) e escolha a **Função**. Clique em **Guardar**.
2. Clique em **Ficheiro de credenciais** para dar palavras-passe temporárias às contas migradas. Entregue a cada pessoa apenas a sua linha.
3. Clique no ícone **Mapas que este utilizador pode abrir** para ver o que essa pessoa vê. Altere o nível de uma partilha ou entregue um mapa a um **Novo proprietário**.
4. Para impedir o acesso, clique em **Desativar**. Clique em **Ativar** para anular.

| Escolha | Significado |
|---|---|
| ADMIN | Tudo. |
| MANAGER | Vê, executa, exporta, agenda e partilha todos os mapas. Edita as contas MANAGER, USER e VIEWER. Nunca altera o modelo de dados, as funções personalizadas nem as origens de dados. |
| USER | Mapas próprios, públicos e partilhados. |
| VIEWER | Como USER, mas não pode copiar mapas. |
| **Desativar** | Mantém a conta. Reversível. |
| **Eliminar** | Remove a conta de forma definitiva. Não pode ser anulado. |

---

# Políticas de Segurança e Registo de Auditoria

Uma **política** filtra as linhas que as pessoas veem. O **Registo de Auditoria** mostra quem fez o quê.

![A caixa de diálogo Nova Política com um nome, uma descrição e uma regra.](shots/pt-PT/admin/44-security-new-dialog.png)

1. Em **Segurança**, clique em **Nova Política**. Escreva um **Nome**.
2. Escolha **Aplica-se a** (**Área de Negócio** ou **Pasta**) e o destino.
3. Escreva o **Predicado SQL**, por exemplo `{alias}.REGION = 'NORTH'`. Clique em **Validar**. Clique em **Guardar**.
4. Clique no ícone **Atribuições**. Escolha **Utilizador** ou **Função**. Clique em **Atribuir**.
5. No **Registo de Auditoria**, filtre por **Utilizador**, **Ação** ou **De**/**Até**. Clique num ícone **Ver detalhes** para ver a entrada completa.

> **Atenção:** Uma pasta sem política segue uma definição da instalação. No modo **fechado** (o predefinido) ninguém vê as suas linhas, nem mesmo você. No modo **aberto** todos os que têm permissão veem todas as linhas.

---

# Migração

A **Migração** importa um EUL do Oracle Discoverer (as áreas de negócio, pastas, livros e utilizadores nele guardados). Escreve muitos dados nesta base de dados.

![A página Migração com o cartão da origem, os respetivos botões e o texto de ajuda.](shots/pt-PT/admin/50-migration.png)

1. Registe a ligação Oracle em **Origens de Dados**.
2. Em **Migração**, escolha a **Origem de dados Oracle**. Clique em **Detetar versão** e depois em **Analisar**.
3. Deixe **Simulação** assinalada. Clique em **Executar simulação**. Leia o relatório e o registo.
4. Desmarque **Simulação** e clique em **Executar migração**.
5. Em **Utilizadores**, clique em **Ficheiro de credenciais** para que as pessoas migradas possam iniciar sessão.
6. Mova os mapas de "Migrated Workbooks" para a área de negócio certa.

| Escolha | Significado |
|---|---|
| **Reimportar mapas** | Reconstrói apenas os mapas. Substitui todos os mapas em "Migrated Workbooks". As edições, agendamentos e partilhas desses mapas perdem-se. |
| **Reimportar tudo** | Reescreve o que difere. Não elimina nada. Mantém os ids, agendamentos e partilhas. |
| **Compilar campos calculados** | Use se um mapa disser que um campo "has not compiled". |

> **Atenção:** Faça sempre primeiro uma simulação.
