# A sua função num relance

O Discoverer Neo substitui o Oracle Discoverer. Um **mapa** é um relatório (no Oracle Discoverer, era uma folha de cálculo). Um **livro** é um grupo de mapas. Uma **área de negócio** é um grupo de dados relacionados. Tem a função **VIEWER**. O seu trabalho principal é abrir mapas, executá-los e ler os resultados.

| Pode | Não pode |
|---|---|
| Ver os seus próprios mapas, os mapas públicos e os mapas partilhados consigo | Ver mapas privados que ninguém partilhou consigo |
| Executar um mapa e ler os resultados, ordenar, filtrar e aprofundar | Copiar um mapa ou um livro |
| Exportar resultados, se o mapa for público ou partilhado consigo como **Pode exportar** ou **Pode editar** | Exportar um mapa partilhado consigo apenas como **Pode ver** |
| Ver as suas próprias execuções e exportações | Ver as execuções ou exportações de outras pessoas |
| Escolher o seu idioma, tema e cores | Abrir as páginas de administração (não estão no seu menu) |

A função VIEWER tem um limite fixo: não pode copiar mapas nem livros. Tudo o resto depende do que lhe foi concedido para cada mapa e cada área de negócio. Veja a secção seguinte.

## De onde vem o seu acesso

A função não decide o que pode executar, exportar ou agendar. Estas três coisas decidem.

- **O mapa.** Vê um mapa se o criou, se o proprietário o tornou **Público**, ou se alguém o partilhou consigo. Uma permissão numa área de negócio **não** lhe mostra mapas.
- **O nível de partilha.** A maior parte dos mapas chega até si como uma partilha. O nível diz-lhe o que pode fazer.
- **As suas permissões de área de negócio.** Para ler os dados de um mapa, o seu administrador tem de lhe ter dado acesso às áreas de negócio que ele usa. Sem isso, a execução falha com "Sem autorização para executar".

| Situação | Abrir e executar | Exportar | Agendar | Alterar o mapa |
|---|---|---|---|---|
| Partilhado consigo: **Pode ver** | Sim | Não | Não | Não |
| Partilhado consigo: **Pode exportar** | Sim | Sim | Sim | Não |
| Partilhado consigo: **Pode editar** | Sim | Sim | Sim | Sim |
| Mapa público de que não é proprietário | Sim | Sim | Não | Não |

Este guia cobre o que faz com mais frequência: encontrar um mapa, executá-lo e lê-lo. Exportar, agendar e editar só funcionam quando o mapa é partilhado consigo com o nível necessário. Essas partes são curtas, no fim de cada capítulo.

Se faltar um mapa de que precisa, peça ao respetivo proprietário que o partilhe consigo.

## Iniciar sessão, alterar a palavra-passe, terminar sessão

1. Abra o endereço que o seu administrador lhe deu.
2. Escreva o seu **Email** e a sua **Palavra-passe**.
3. Deixe **Manter sessão iniciada** assinalado para continuar com a sessão iniciada depois de fechar o navegador. Desmarque-o num computador partilhado.
4. Clique em **Iniciar sessão**.

![A página de início de sessão com Email, Palavra-passe, Manter sessão iniciada e o botão Iniciar sessão.](shots/pt-PT/common/01-login.png)

Se a sua conta foi criada com uma palavra-passe temporária, abre-se primeiro a página **Alterar a palavra-passe**. Preencha **Palavra-passe temporária**, **Nova palavra-passe** (pelo menos 12 caracteres, diferente da anterior) e **Confirmar nova palavra-passe** e depois clique em **Alterar palavra-passe**.

Se se esquecer da palavra-passe, peça ao seu administrador que a reponha. Para terminar a sessão, clique no seu nome no canto superior direito e depois em **Terminar sessão**. Isto termina a sua sessão. Para voltar a usar o Discoverer Neo, inicie sessão novamente.

---

# Painel

O **Painel** é a primeira página depois de iniciar sessão. É um resumo. É só de leitura.

![O painel do Viewer com a barra lateral reduzida e os cartões de resumo.](shots/pt-PT/viewer/01-dashboard.png)

| Cartão | O que mostra |
|---|---|
| **Total de Mapas** | Os mapas que pode abrir, com quantos são seus e quantos são partilhados consigo (os mapas públicos também são contados aqui) |
| **Total de Execuções** | Execuções dos mapas que pode ver, feitas por qualquer pessoa |
| **Mapas Agendados** e **Resultados Agendados** | Os seus próprios agendamentos. Normalmente são zero no seu caso |
| **Mapas Recentes** | Mapas que criou. Normalmente está vazio no seu caso |

---

# Mapas

A página **Mapas** é a sua lista de relatórios. Use-a para encontrar um mapa e abri-lo.

![A lista de Mapas, separador Todos, onde cada mapa tem apenas o ícone Abrir.](shots/pt-PT/viewer/03-maps-all.png)

| Controlo | O que faz |
|---|---|
| **Meus**, **Partilhado comigo**, **Todos** | Os seus próprios mapas, os mapas partilhados consigo, ou tudo o que pode ver. Se não for proprietário de nenhum, a página abre em **Todos** |
| **Procurar mapas por nome…** | Filtra por nome à medida que escreve |
| Filtro **Área de Negócio** | Mostra uma área de negócio. **Todas as áreas de negócio** remove o filtro |
| **Ordenar por** | **Recentemente atualizado** ou **Nome (A–Z)** |
| **Limpar** | Remove a pesquisa e o filtro |
| Nome do mapa ou ícone do olho | Abre o mapa no visualizador |

A tabela mostra **Nome**, **Livro**, **Proprietário**, **Área de Negócio**, **Tipo**, **Atualizado** e **Ações**.

Não vê um ícone Copiar, e não existe o botão **Copiar livro**. É assim por definição para a sua função.

Por cima da tabela, **Pastas de trabalho** lista os livros que contêm os seus mapas. Escreva em **Procurar pastas de trabalho ou folhas...**, clique num livro para o abrir e depois clique numa folha para abrir o visualizador.

![A lista de Mapas, separador Partilhado comigo, com o cartão Pastas de trabalho e apenas o ícone Abrir.](shots/pt-PT/viewer/02-maps-shared.png)

> **Nota:** Alguns ícones de uma linha (por exemplo o lápis, o calendário ou o lixo) só funcionam se for proprietário do mapa ou se ele tiver sido partilhado consigo com um nível suficiente. Se clicar num e o servidor recusar, aparece "Forbidden". Nada é alterado.

Exemplo: para encontrar o mapa de demonstração, escreva **GD_M.M10_V01.DIS** na caixa de pesquisa e clique no respetivo nome.

---

# O visualizador de mapas

O visualizador executa um mapa e mostra as respetivas linhas. É aqui que passa a maior parte do tempo.

![Uma execução concluída com os botões Excel, CSV e PDF por cima da grelha de resultados.](shots/pt-PT/viewer/06-viewer-results.png)

| Botão ou controlo | O que faz |
|---|---|
| **Voltar** | Regressa à página anterior |
| **Executar** | Executa o mapa. Se o mapa pedir valores, abre-se primeiro uma caixa de diálogo |
| **Executar novamente** | Executa de novo com os mesmos valores e ignora o resultado guardado. Aparece depois de uma execução terminar |
| **Cancelar** | Pára uma execução que ainda está à espera na fila |

Por baixo dos botões, uma linha de estado mostra **Em fila**, **A executar…** ou a hora do resultado e durante quanto tempo se mantém válido (24 horas). "A mostrar um resultado em cache" significa que executou este mapa com os mesmos valores há pouco tempo. Clique em **Executar novamente** para obter dados atualizados.

## Parâmetros de execução

Alguns mapas pedem valores, como uma data. Em **Parâmetros de execução**, preencha cada campo (um * vermelho significa obrigatório) e clique em **Executar**. **Cancelar** fecha a caixa de diálogo.

![A caixa de diálogo Parâmetros de execução com os dois valores obrigatórios preenchidos.](shots/pt-PT/viewer/05-viewer-params-filled.png)

## Ler os resultados

| Elemento | O que significa |
|---|---|
| **Resultados**, etiquetas de linhas e ms | Quantas linhas vieram e quanto tempo demorou |
| **Existem mais linhas disponíveis** | O resultado foi cortado. Só parte das linhas foi devolvida |
| Cabeçalho de coluna (clique) | Ordena por essa coluna: ascendente, descendente, nenhuma |
| Caixa **Filtrar…** por baixo de um cabeçalho | Filtra as linhas que carregou |
| Etiqueta **Grupo**, **Total de …**, **Total geral** | As linhas são agrupadas e têm subtotais. Ordenar ou filtrar suspende-os |
| Duplo clique numa linha | **Ver Detalhe**: mostra as linhas de origem por trás dessa linha |
| **Carregar mais** | Carrega as 500 linhas seguintes |
| Células coloridas | Regras que o proprietário definiu para realçar valores |

Um mapa de tabela cruzada mostra uma tabela dinâmica.

## Quando uma execução não funciona

| O que vê | O que significa |
|---|---|
| **Sem autorização para executar** (vermelho) | Pode ver o mapa, mas não tem acesso aos respetivos dados. Fale com o seu administrador |
| **Pedido recusado** ou **Folha não executada** (âmbar) | O mapa está construído de uma forma que não pode ser executada em segurança. A caixa explica porquê. Avise o proprietário do mapa |
| **A consulta excedeu o tempo limite** | A consulta demorou demasiado. Tente mais tarde ou avise o proprietário |
| **Mapa não encontrado** | O mapa foi eliminado ou já não está partilhado consigo |

## Exportar (só se o seu acesso o permitir)

Os botões **Excel**, **CSV** e **PDF** aparecem por baixo dos resultados depois de uma execução. Funcionam para mapas públicos e para mapas partilhados consigo como **Pode exportar** ou **Pode editar**.

| Botão | O que faz |
|---|---|
| **Excel** | Transfere um ficheiro Excel |
| **CSV** | Transfere um ficheiro CSV |
| **PDF** | Abre **Exportar para PDF**: escolha o **Tamanho do papel** (A4, A3, Carta), a **Orientação** (Vertical, Horizontal) e as colunas e depois clique em **Exportar** |

![A caixa de diálogo de exportação para PDF com as opções de orientação, tamanho da página, título e tipo de letra.](shots/pt-PT/user/17-builder-pdf-dialog.png)

> **Nota:** Se o mapa for partilhado consigo apenas como **Pode ver**, os botões continuam no ecrã, mas a exportação falha com "Forbidden". Peça ao proprietário **Pode exportar**.

---

# Execuções

A página **Execuções** lista todas as execuções de mapas que iniciou. Use-a para voltar a encontrar um resultado sem executar o mapa uma segunda vez.

![A página Execuções com as execuções do próprio Viewer.](shots/pt-PT/viewer/07-runs.png)

| Controlo | O que faz |
|---|---|
| Filtros **Mapa**, **Estado** e **Tipo** | Reduzem a lista. O tipo é **Em direto** (executou-o você) ou **Agendada** |
| Ícone **Abrir** | Abre o resultado guardado |
| Ícone **Executar novamente** | Inicia uma execução com os mesmos valores |
| **XLSX**, **CSV**, **PDF** | Transfere um resultado, se o seu acesso permitir exportar |
| Ícone **Cancelar** | Cancela uma execução que ainda está em fila |
| Ícone **Eliminar** | Elimina de forma definitiva uma execução terminada |

A tabela mostra **Mapa**, **Tipo**, **Parâmetros**, **Estado**, **Linhas**, **Duração**, **Executado em**, **Expira em** e **Ações**. Um resultado em direto mantém-se 24 horas. Quando **Expira em** indicar **Expirado**, execute o mapa novamente. Só vê as suas próprias execuções.

---

# Exportações

A página **Exportações** lista os ficheiros que pediu.

![A página Exportações com a lista de exportações e um botão Transferir nas concluídas.](shots/pt-PT/user/44-exports.png)

A tabela mostra **Mapa**, **Formato**, **Estado** (**Em fila**, **Em execução**, **Concluída**, **Falhada**), **Linhas** e **Criado**. Clique no ícone **Transferir** numa linha concluída. Os ficheiros são mantidos durante 7 dias. Se a transferência falhar, exporte novamente a partir do visualizador. Se nunca exportar, esta página fica vazia.

---

# Agendamentos

A página **Agendamentos** lista os horários que executam um mapa automaticamente. Só é sua se for proprietário de um mapa ou tiver **Pode exportar** ou **Pode editar** sobre ele. Com **Pode ver** ou num mapa público não pode agendar. Esses mapas não aparecem na lista **Mapa** de **Novo Agendamento**.

![A página Agendamentos com a mensagem Ainda não existem agendamentos.](shots/pt-PT/viewer/09-schedules.png)

Se tiver mesmo o nível certo:

1. Clique em **Novo Agendamento**, ou no ícone do calendário em **Mapas**.
2. Escolha o **Mapa** e escreva um **Nome**.
3. Escolha a **Frequência** (**Diário**, **Semanal**, **Quinzenal**, **Mensal**, a cada 2, 3, 4 ou 6 meses, **Anual**, ou **Personalizado (cron)**), a respetiva **Hora** e dia, o **Fuso horário** e o **Formato de Saída** (**Excel (.xlsx)** ou **CSV**). Um parâmetro pode ter um **Valor fixo**, ou ser **Relativo à data de execução**, por exemplo -1 **meses**, **último dia desse mês**.
4. Clique em **Guardar**.

Use os ícones de cada linha para **Executar agora**, **Pausar** ou **Ativar**, ver o **Histórico**, **Editar** ou **Eliminar**. Os resultados ficam no servidor. Nada é enviado por e-mail.

---

# Definições

As **Definições** alteram o aspeto da aplicação para si. Abra-as na barra lateral ou a partir do seu nome.

![A página Definições com os cartões Idioma de exibição, Aparência e Paleta.](shots/pt-PT/common/04-settings.png)

| Controlo | O que faz |
|---|---|
| **Idioma de exibição** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Aparência** | **Claro**, **Escuro**, **Alto contraste** |
| **Paleta** | **Clássica**, **Azul-marinho**, **Floresta**, **Vinho**, **Oceano**, **Ocre**. Não disponível com **Alto contraste** |
| **Guardar** | Guarda as suas escolhas na sua conta |

As suas escolhas aparecem de imediato. Clique em **Guardar** para as manter em todos os dispositivos.

---

# Perguntas frequentes

**Não consigo ver um mapa que um colega vê.** Só vê os seus mapas, os públicos e os partilhados. Peça ao proprietário que o partilhe. Os gestores e os administradores veem todos os mapas.

**Porque não há um ícone Copiar?** A função VIEWER não pode copiar mapas nem livros. Fale com o proprietário ou com o seu administrador.

**Aparece "Sem autorização para executar".** Não tem acesso aos dados desse mapa. Fale com o seu administrador.

**Excel, CSV ou PDF diz "Forbidden".** O mapa é partilhado consigo apenas como **Pode ver**. Peça ao proprietário **Pode exportar**.

**O ícone Editar ou Agendar não faz nada.** Estes precisam de **Pode editar** ou **Pode exportar** sobre o mapa, ou de ser o proprietário.

**O meu resultado diz Expirado.** Os resultados em direto mantêm-se 24 horas. Clique em **Executar novamente**.

**Não encontro uma exportação antiga.** Os ficheiros são removidos ao fim de 7 dias.

**Esqueci-me da palavra-passe.** Peça ao seu administrador que a reponha.

---

# Glossário

| Termo | Significado |
|---|---|
| Mapa | Um relatório. No Oracle Discoverer era uma folha de cálculo |
| Livro | Um grupo de mapas |
| Área de negócio | Um grupo de dados relacionados |
| Execução | Uma execução de um mapa que produz um resultado |
| Exportação | Um ficheiro (Excel, CSV ou PDF) feito a partir de um resultado |
| Agendamento | Um horário que executa um mapa automaticamente |
| Partilha | Acesso a um mapa dado pelo respetivo proprietário: **Pode ver**, **Pode exportar** ou **Pode editar** |
| Mapa público | Um mapa que todos os utilizadores podem abrir, executar e exportar |
| Parâmetro | Um valor que o mapa pede quando o executa |
