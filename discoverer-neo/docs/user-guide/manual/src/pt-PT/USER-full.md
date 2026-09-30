# A sua função num relance

O Discoverer Neo substitui o Oracle Discoverer. Um **mapa** é um relatório (no Oracle Discoverer, era uma folha de cálculo). Um **livro** é um grupo de mapas. Uma **área de negócio** é um grupo de dados relacionados. Tem a função **USER**. Permite-lhe abrir e executar mapas, exportá-los e agendá-los, e criar mapas seus.

| Pode | Não pode |
|---|---|
| Ver os seus próprios mapas, os mapas públicos e os mapas partilhados consigo | Ver mapas privados que ninguém partilhou consigo |
| Executar um mapa e ver os respetivos resultados | Executar um mapa sobre dados a que não tem acesso |
| Exportar resultados para Excel, CSV ou PDF, se o nível de partilha do mapa o permitir | Exportar um mapa que é partilhado consigo apenas como **Pode ver** |
| Agendar um mapa, se for o proprietário ou se ele for partilhado consigo como **Pode exportar** ou **Pode editar** | Agendar um mapa público de que não é proprietário |
| Copiar qualquer mapa que consiga ver e alterar a sua cópia | Alterar um mapa de que não é proprietário, exceto se for partilhado consigo como **Pode editar** |
| Criar um mapa novo, mas só numa área de negócio onde o administrador lhe deu o direito de criar | Criar mapas noutras áreas de negócio |
| Partilhar e eliminar mapas de que é proprietário | Partilhar ou eliminar mapas que pertencem a outra pessoa |
| Ver as suas próprias execuções, exportações e agendamentos | Ver as execuções, exportações ou agendamentos de outras pessoas |
| Escolher o seu idioma, tema e cores | Abrir as páginas de administração (não estão no seu menu) |

## De onde vem o seu acesso

Três coisas decidem o que pode fazer. A sua função é apenas a primeira.

- **O mapa.** Vê um mapa se o criou, se o proprietário o tornou **Público**, ou se alguém o partilhou consigo. Uma permissão numa área de negócio **não** lhe mostra mapas.
- **O nível de partilha.** Para um mapa de que não é proprietário, o nível de partilha diz-lhe o que pode fazer. Veja a tabela abaixo.
- **As suas permissões de área de negócio.** O seu administrador dá-lhe direitos sobre áreas de negócio. Para ler os dados de um mapa, precisa de acesso aos dados que ele usa. Para criar um mapa novo, precisa do direito de **criar** nessa área de negócio. Sem isso, as execuções do mapa falham com "Sem autorização para executar", ou falha o guardar de um mapa novo.

| Situação | Abrir e executar | Exportar | Agendar | Alterar o mapa |
|---|---|---|---|---|
| É o proprietário do mapa | Sim | Sim | Sim | Sim |
| Partilhado consigo: **Pode ver** | Sim | Não | Não | Não |
| Partilhado consigo: **Pode exportar** | Sim | Sim | Sim | Não |
| Partilhado consigo: **Pode editar** | Sim | Sim | Sim | Sim |
| Mapa público de que não é proprietário | Sim | Sim | Não | Não |

> **Nota:** Só o proprietário pode partilhar ou eliminar um mapa. Quem tem **Pode editar** não o pode partilhar com mais ninguém.

Se faltar um mapa de que precisa, peça ao respetivo proprietário que o partilhe consigo.

## Iniciar sessão, alterar a palavra-passe, terminar sessão

1. Abra o endereço que o seu administrador lhe deu.
2. Escreva o seu **Email** e a sua **Palavra-passe**.
3. Deixe **Manter sessão iniciada** assinalado se quiser continuar com a sessão iniciada depois de fechar o navegador. Desmarque-o num computador partilhado.
4. Clique em **Iniciar sessão**.

![A página de início de sessão com Email, Palavra-passe, Manter sessão iniciada e o botão Iniciar sessão.](shots/pt-PT/common/01-login.png)

Se a sua conta foi criada com uma palavra-passe temporária, abre-se primeiro a página **Alterar a palavra-passe**. Não pode usar o resto da aplicação enquanto não a alterar.

| Campo | O que escrever |
|---|---|
| **Palavra-passe temporária** (ou **Palavra-passe atual**) | A palavra-passe que usa agora |
| **Nova palavra-passe** | Pelo menos 12 caracteres. Tem de ser diferente da atual |
| **Confirmar nova palavra-passe** | A mesma palavra-passe nova, outra vez |

Clique em **Alterar palavra-passe**. O painel abre-se.

Se se esquecer da palavra-passe, peça ao seu administrador que a reponha. Não existe reposição por iniciativa própria.

Para terminar a sessão, clique no seu nome no canto superior direito e depois em **Terminar sessão**. Isto termina a sua sessão. Para voltar a usar o Discoverer Neo, inicie sessão novamente.

> **Nota:** Depois de 5 palavras-passe erradas seguidas, a sua conta fica bloqueada durante 15 minutos. Aguarde e tente novamente.

---

# Painel

O **Painel** é a primeira página depois de iniciar sessão. Dá-lhe um resumo rápido. É só de leitura. Use-o para ver quanto tem e para saltar para os seus últimos mapas.

![O painel com os cartões de resumo e a lista Mapas Recentes.](shots/pt-PT/user/45-dashboard.png)

| Cartão | O que mostra |
|---|---|
| **Total de Mapas** | Os mapas que pode abrir. A linha por baixo diz quantos são seus e quantos são partilhados consigo (os mapas públicos também são contados aqui) |
| **Total de Execuções** | Execuções dos mapas que pode ver, feitas por qualquer pessoa |
| **Mapas Agendados** | Mapas para os quais tem pelo menos um agendamento ativo |
| **Resultados Agendados** | Resultados guardados pelos seus agendamentos |
| **Mapas Recentes** | Os seus últimos 5 mapas criados por si, do mais recente para o mais antigo. Clique num para o abrir no construtor de mapas |
| **Ver agendamentos** (ligação em dois cartões) | Abre a página **Agendamentos** |

Se não criou nenhum mapa, **Mapas Recentes** diz que nenhum é seu.

---

# Mapas

A página **Mapas** é a sua lista de relatórios. Use-a para encontrar um mapa, executá-lo, copiá-lo, partilhá-lo ou eliminá-lo.

![A lista de Mapas, separador Meus, com os ícones de ação na linha do mapa.](shots/pt-PT/user/03-maps-mine.png)

## Separadores, pesquisa e filtros

| Controlo | O que faz |
|---|---|
| **Meus** | Mapas que criou |
| **Partilhado comigo** | Mapas que outras pessoas partilharam consigo, com qualquer nível |
| **Todos** | Tudo o que pode ver: os seus próprios mapas, os públicos e os partilhados |
| **Procurar mapas por nome…** | Filtra a lista por nome à medida que escreve |
| Filtro **Área de Negócio** | Mostra só os mapas de uma área de negócio. **Todas as áreas de negócio** remove o filtro |
| **Ordenar por** | **Recentemente atualizado** ou **Nome (A–Z)** |
| **Limpar** | Repõe a pesquisa e a área de negócio. Só aparece quando há um filtro ativo |
| **Criar Mapa** | Abre o construtor de mapas para um mapa novo |

A tabela mostra **Nome**, **Livro**, **Proprietário**, **Área de Negócio**, **Tipo**, **Atualizado** e **Ações**. Se não for proprietário de nenhum mapa, a página abre em **Todos**.

## Ações da linha

Cada linha tem ícones. Passe o cursor sobre um ícone para ler a sua dica.

| Ícone | O que faz |
|---|---|
| Nome do mapa | Abre o mapa no construtor se o puder alterar, caso contrário no visualizador |
| Olho | Abre o visualizador, onde executa o mapa e vê as linhas |
| Lápis | Abre o construtor de mapas. Só para os seus próprios mapas e para mapas partilhados consigo como **Pode editar** |
| Copiar | Faz a sua própria cópia privada e abre-a. Passa a ser o proprietário |
| Partilhar | Abre a caixa de diálogo **Partilhar mapa**. Só para mapas de que é proprietário |
| Calendário | Abre **Agendamentos** com este mapa escolhido. Só para mapas de que é proprietário ou que são partilhados como **Pode exportar** ou **Pode editar** |
| Transferir | Abre o visualizador, onde exporta |
| Lixo | Elimina o mapa. Só para os seus próprios mapas |

> **Nota:** Os ícones do calendário e de transferir para mapas partilhados aparecem no separador **Partilhado comigo**. No separador **Todos**, abra antes o mapa no visualizador.

> **Atenção:** Só um administrador pode repor um mapa eliminado. **Eliminar mapa?** pede-lhe que confirme com **Eliminar**.

## Livros

Por cima da tabela, aparece uma secção **Pastas de trabalho** quando alguns dos seus mapas pertencem a um livro.

| Controlo | O que faz |
|---|---|
| **Procurar pastas de trabalho ou folhas...** | Filtra pelo nome do livro ou da folha |
| Linha de livro | Clique para abrir a lista das suas folhas. Clique numa folha para abrir o visualizador |
| Lápis numa folha | Editar. Só para folhas que criou |
| Copiar | **Copiar livro**: cria um livro novo com uma cópia privada de cada folha |
| Lixo | **Eliminar livro**: elimina o livro e todas as suas folhas. Só se for proprietário de todas as folhas |

O botão **Partilhar livro** não é para a sua função. Partilhe cada mapa de que é proprietário com o respetivo ícone **Partilhar**.

![A caixa de diálogo Copiar livro com o campo do nome do novo livro.](shots/pt-PT/user/02-workbook-copy-dialog.png)

Exemplo: para copiar o mapa de demonstração, encontre **GD_M.M10_V01.DIS**, clique no ícone Copiar e confirme. A sua cópia abre-se no construtor e pode alterá-la à vontade. O original fica como estava.

## Copiar um mapa

1. Encontre o mapa na lista.
2. Clique no ícone Copiar.
3. A cópia abre-se no construtor com a mensagem "Mapa copiado. Está agora a editar a sua cópia."
4. Altere o que precisar e clique em **Guardar**.

Executar a cópia continua a exigir acesso aos dados. Copiar não lho dá.

## Partilhar um mapa de que é proprietário

1. Clique no ícone Partilhar no seu mapa.
2. Procure uma pessoa pelo nome ou e-mail.
3. Clique num nível junto ao nome dessa pessoa. O botão escuro é o nível que ela tem agora.
4. Para remover o acesso, clique no **✕** junto ao nome.

![A caixa de diálogo Partilhar mapa com uma pessoa encontrada e os botões Pode ver, Pode exportar e Pode editar.](shots/pt-PT/user/29-share-dialog-search.png)

| Opção | O que significa / quando escolher |
|---|---|
| **Pode ver** | A pessoa pode abrir e executar o mapa. Não pode exportá-lo, agendá-lo nem alterá-lo |
| **Pode exportar** | Como acima, e pode exportar o resultado e pôr o mapa num agendamento |
| **Pode editar** | Tudo o que foi dito acima, e também pode alterar o mapa. Continua a não o poder partilhar nem eliminar |
| **✕** | Remove o acesso da pessoa |

Se o mapa for público, a caixa de diálogo diz "Este mapa é público — qualquer pessoa com a ligação pode vê-lo." e mostra **Copiar ligação**. Use-o para enviar o endereço a um colega.

---

# O visualizador de mapas

O visualizador abre-se quando clica no nome de um mapa (de um mapa que não pode editar) ou no ícone do olho. Use-o para executar um mapa e ler os respetivos resultados.

![O visualizador de mapas depois de uma execução concluída, com a grelha de resultados e os botões de exportação.](shots/pt-PT/user/25-viewer-results.png)

| Botão ou controlo | O que faz |
|---|---|
| **Voltar** | Regressa à página de onde veio |
| **Executar** | Executa o mapa. Se o mapa pedir valores (parâmetros), abre-se primeiro uma caixa de diálogo |
| **Executar novamente** | Executa o mapa de novo com os mesmos valores e ignora o resultado guardado. Aparece depois de uma execução terminar |
| **Cancelar** | Pára uma execução que ainda está à espera na fila. Deixa de ser oferecido quando a execução já começou |
| **Gestão de agendamentos** | Abre a página **Agendamentos** |

Enquanto uma execução decorre, uma linha por baixo dos botões mostra **Em fila** ou **A executar…**. Quando termina, mostra a hora e durante quanto tempo o resultado se mantém válido (24 horas). Se executou o mesmo mapa com os mesmos valores há pouco tempo, pode ver "A mostrar um resultado em cache". Use **Executar novamente** para obter dados atualizados.

Se um mapa não tem colunas, o visualizador diz-lhe que não há nada para executar.

## Parâmetros de execução

Alguns mapas pedem-lhe valores, como uma data ou uma região. A caixa de diálogo **Parâmetros de execução** mostra um campo por parâmetro. Um * vermelho significa que o valor é obrigatório. Para alguns valores, a caixa de diálogo sugere os valores reais dos dados. Clique em **Executar** para começar, ou em **Cancelar** para fechar.

![A caixa de diálogo Parâmetros de execução com os dois valores obrigatórios preenchidos.](shots/pt-PT/user/24-viewer-params-filled.png)

## Ler os resultados

| Elemento | O que significa |
|---|---|
| Cabeçalho **Resultados** com etiquetas de linhas e ms | Quantas linhas vieram e quanto tempo demorou |
| **Existem mais linhas disponíveis** | O resultado foi cortado. Só parte das linhas foi devolvida |
| Cabeçalho de coluna (clique) | Ordena por essa coluna: ascendente, descendente, nenhuma |
| Caixa **Filtrar…** por baixo de um cabeçalho | Filtra as linhas que carregou |
| Etiqueta **Grupo**, **Total de …**, **Total geral** | O mapa agrupa linhas e mostra subtotais. Ordenar ou filtrar suspende-os |
| Duplo clique numa linha | **Ver Detalhe**: mostra as linhas de origem por trás dessa linha |
| **Carregar mais** | Carrega as 500 linhas seguintes |
| Células coloridas | Regras definidas pelo proprietário do mapa (formatação condicional) |

Um mapa de tabela cruzada mostra uma tabela dinâmica quando uma coluna é colocada **No topo**.

## Exportar os resultados

Por baixo dos resultados, use estes botões. Aparecem quando uma execução termina.

| Botão | O que faz |
|---|---|
| **Excel** | Transfere um ficheiro Excel |
| **CSV** | Transfere um ficheiro CSV |
| **PDF** | Abre **Exportar para PDF**, onde escolhe o papel e as colunas |

![A caixa de diálogo de exportação para PDF com as opções de orientação, tamanho da página, título e tipo de letra.](shots/pt-PT/user/17-builder-pdf-dialog.png)

| Opção em **Exportar para PDF** | O que significa / quando escolher |
|---|---|
| **Tamanho do papel**: A4, A3, Carta | A4 é o predefinido. Escolha A3 para tabelas largas, Carta para papel dos EUA |
| **Orientação**: Vertical, Horizontal | Horizontal comporta mais colunas |
| **Colunas** | Assinale as colunas a imprimir. **Selecionar todas** e **Limpar** alternam todas |

Clique em **Exportar**. O ficheiro é criado em segundo plano. Encontre-o mais tarde na página **Exportações**.

> **Nota:** Os botões de exportação aparecem em todos os mapas. Se o seu acesso ao mapa for apenas **Pode ver**, a exportação falha com "Forbidden". Peça ao proprietário **Pode exportar**.

Exemplo: abra **GD_M.M10_V01.DIS**, clique em **Executar** e depois em **Excel**.

---

# Construir e editar mapas

Só pode construir um mapa novo numa área de negócio onde o administrador lhe deu o direito de **criar**. Pode alterar um mapa existente se for o proprietário ou se ele for partilhado consigo como **Pode editar**. O construtor abre-se a partir de **Criar Mapa**, do ícone do lápis ou de **Mapas Recentes**.

![O construtor de mapas com a árvore Áreas de Negócio, a área de Colunas e o painel Propriedades.](shots/pt-PT/user/05-builder-overview.png)

O construtor tem uma barra de ferramentas no topo, uma árvore **Áreas de Negócio** à esquerda, a área **Colunas** no meio e um painel de definições com cinco separadores à direita. Pode arrastar as margens para redimensionar os painéis.

> **Atenção:** O construtor nunca guarda automaticamente. Clique em **Guardar**. Se sair da página, as alterações não guardadas perdem-se.

## Barra de ferramentas

| Botão ou controlo | O que faz |
|---|---|
| **Voltar** | Regressa à página anterior |
| Caixa do nome do mapa | O nome do mapa |
| Lista do tipo de mapa | **Tabela**, **Tabela Cruzada**, **Página-Detalhe** ou **Gráfico**. Só **Tabela Cruzada** muda o aspeto dos resultados. Os outros três mostram uma tabela simples |
| **● Não guardado** | Indica que tem alterações que não estão guardadas |
| **Executar** | Guarda o mapa se for novo ou se tiver sido alterado e depois executa-o |
| **Guardar** | Guarda o mapa. Precisa de pelo menos uma coluna |
| **Exportar** | Menu com **Definição do mapa (.xml)**, que transfere o desenho do mapa, não os dados. A exportação de dados está por baixo dos resultados |
| **Agendar** | Abre **Agendamentos** com este mapa escolhido. Precisa de um mapa guardado |
| **Formatação** | Abre **Formatação condicional**. Precisa de um mapa guardado |
| **Partilhar** | Abre **Partilhar mapa**. Precisa de um mapa guardado. Só o proprietário pode alterar partilhas |
| **Colapsar painel** / **Expandir painel** | Esconde ou mostra o painel da direita |

## Adicionar colunas

1. Na árvore **Áreas de Negócio** à esquerda, abra uma área de negócio e depois uma pasta. Uma pasta contém itens (uma pasta é como uma tabela).
2. Arraste um item para a área **Colunas**, ou clique no **+** junto a ele. Um ícone de sigma marca uma medida (um número que se soma). Um ícone de etiqueta marca uma dimensão (uma etiqueta de texto).
3. Todas as colunas de um mapa têm de vir da mesma área de negócio. A primeira coluna que adiciona define-a. Não pode escolher a área.
4. Use a caixa **Filtrar itens…** para encontrar um item pelo nome.
5. Arraste a pega de uma coluna para a reordenar. Clique em **X** para a remover. Clique na etiqueta da coluna para a configurar.

Se vir "Nenhuma área de negócio.", ainda não tem acesso a nenhuma área de negócio. Fale com o seu administrador.

> **Nota:** A árvore mostra todas as áreas de negócio sobre as quais tem algum direito. Pode construir um mapa só com direitos de visualização, mas **Guardar** num mapa novo falha sem o direito de criar.

## Configurar uma coluna

Clique na etiqueta de uma coluna. As alterações aplicam-se ao rascunho. Clique em **Guardar** na caixa de diálogo e depois em **Guardar** no mapa.

| Campo | O que faz |
|---|---|
| **Nome a apresentar** | Título da coluna. Vazio significa o nome do item |
| **Agregação** | **NONE**, **SUM**, **COUNT**, **AVG**, **MIN** ou **MAX** |
| **Direção de ordenação** | **Nenhum**, **Ascendente**, **Descendente** |
| **Máscara de Formato** e **Predefinições** | Um formato de número ou de data. Predefinições: **Número (1.234)**, **Decimal (1.234,00)**, **Moeda (1.234,00 €)**, **Percentagem (12,3%)**, **Data (DD-MON-YYYY)**, **Data (YYYY-MM-DD)** |
| **Ordem de ordenação** | Posição desta coluna quando ordena por várias |
| **Largura da coluna (px)** | Largura da coluna |
| **Colocação** | **Nenhum**, **Agrupar por (eixo)**, **Medida** ou **Item de página** |
| **Margem da tabela cruzada** | **Ao lado** ou **No topo**. Só para tabelas cruzadas |
| **Agrupar e quebrar** | Esconde valores repetidos e acrescenta um subtotal sempre que o valor muda |
| **Só na consulta, não mostrar** | A coluna é usada para filtros e totais, mas não é mostrada |

![A caixa de diálogo Configurar coluna com a lista Agregação aberta.](shots/pt-PT/user/08-builder-column-aggregation.png)

## Separadores do painel direito

| Separador | Para que serve |
|---|---|
| **Propriedades** | **Descrição** (impressa por cima dos resultados e das exportações), **Inserir variável** (**Data da execução**, **Hora da execução**, **Nome do livro**, **Nome da folha**, ou um parâmetro) e a caixa **Público** |
| **Condições** | Filtros. **Adicionar Condição**, escolha o item, o operador (`=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`) e o valor. Escolha **Valor estático** ou **Pedir em tempo de execução**. Selecione duas ou mais linhas e clique em **Agrupar** para as unir com OR. Use **Desagrupar** para anular |
| **Ordenação** | **Adicionar ordenação**: escolha uma coluna e uma direção. Arraste para mudar a ordem |
| **Parâmetros** | Valores que são pedidos às pessoas no momento da execução. Cada um tem um nome, um tipo (**STRING**, **NUMBER**, **DATE**, **LIST**), um valor predefinido e uma caixa **Obrigatório**. Se todos os parâmetros tiverem um valor predefinido, o pedido é ignorado |
| **Campos Calculados** | Uma coluna nova a partir de uma fórmula. Clique em **Adicionar Campo Calculado**, dê-lhe um nome e clique na fórmula para abrir o **Editor de fórmulas** |

![O separador Condições com as condições do mapa e os controlos de operador e valor ou pedido.](shots/pt-PT/user/09-builder-conditions.png)

> **Atenção:** A caixa **Público** torna o mapa visível e exportável para todos os utilizadores da aplicação, e não apenas para uma área de negócio. As regras de acesso aos dados continuam a aplicar-se aos dados. Use-a com cuidado.

O **Editor de fórmulas** tem botões de funções (por exemplo **ROUND**, **UPPER**, **TO_CHAR**, **NVL**, **CASE**) e as suas colunas. **Testar fórmula** executa-a nas primeiras 5 linhas. Precisa de um mapa guardado.

## Formatação condicional

Clique em **Formatação** para colorir células ou linhas que cumprem uma regra. As regras são guardadas de imediato. Não fazem parte do **Guardar** do mapa. Só pode adicionar ou eliminar regras em mapas de que é proprietário ou que pode editar.

| Campo | O que significa |
|---|---|
| **Coluna** | A coluna a testar |
| **Aplicar a** | **Célula** ou **Linha** |
| **Operador** | **Igual a**, **Diferente de**, **Maior que**, **Menor que**, **Maior ou igual a**, **Menor ou igual a**, **Contém (caracteres % e _)**, **Na lista**, **Entre**, **Está vazio** |
| **Valor** | Com o que comparar. Use `low,high` para **Entre** |
| **Cor de fundo**, **Cor do texto** | Cores. **Limpar** remove uma |
| **Negrito**, **Itálico**, **Sublinhado** | Estilo do texto |

![A caixa de diálogo Formatação com a lista de regras e os controlos de Adicionar regra.](shots/pt-PT/user/19-builder-formatting-dialog.png)

## Executar a partir do construtor e execuções recusadas

**Executar** abre um painel **Resultados** em baixo. Funciona como o visualizador. Se só tiver direitos de visualização sobre um mapa, não o edite primeiro: o guardar automático seria recusado.

Por vezes o planeador recusa um mapa. Uma caixa âmbar explica porquê e o que mudar. As causas típicas são pastas que não estão ligadas, ou totais de dois conjuntos de linhas de detalhe. Remova a coluna que o causa, ou peça ao seu administrador que defina a junção em falta. Uma faixa vermelha **Sem autorização para executar** significa que não tem acesso aos dados de uma das pastas.

## Exemplo: construir um mapa pequeno

1. Clique em **Criar Mapa** na página **Mapas**.
2. Abra uma área de negócio e arraste dois itens para **Colunas**.
3. Escreva um nome na caixa do nome do mapa.
4. Clique em **Guardar**. O mapa passa a ter o seu próprio endereço.
5. Clique em **Executar**.
6. Clique em **Partilhar** se um colega o deve ver.

---

# Execuções

A página **Execuções** lista todas as execuções de mapas que iniciou, em espera, em curso ou concluídas. Use-a para voltar a encontrar um resultado, ou para o executar novamente.

![A página Execuções com os filtros e a tabela de execuções com os respetivos botões de exportação.](shots/pt-PT/user/41-runs.png)

| Controlo | O que faz |
|---|---|
| Filtro **Mapa** | Mostra um mapa. **Todos os mapas** mostra todos |
| Filtro **Estado** | **Todos os estados**, **Em fila**, **Em execução**, **Concluída**, **Falhada**, **Cancelada** |
| Filtro **Tipo** | **Todos os tipos**, **Em direto** (executou-o você) ou **Agendada** |
| Nome do mapa | Abre o visualizador |
| Ícone **Abrir** | Abre o resultado guardado |
| Ícone **Executar novamente** | Inicia uma execução com os mesmos valores. Diz **Resultado reutilizado** se já existir um resultado válido |
| **XLSX**, **CSV**, **PDF** | Transfere o resultado da execução. Só para resultados terminados e válidos, e só se o seu acesso permitir exportar |
| Ícone **Cancelar** | Cancela uma execução que está em fila. Não é oferecido para uma execução em curso |
| Ícone **Eliminar** | Elimina uma execução terminada, falhada ou cancelada e as respetivas linhas. Não pode ser anulado |

A tabela mostra **Mapa**, **Tipo**, **Parâmetros**, **Estado**, **Linhas**, **Duração**, **Executado em**, **Expira em** e **Ações**. **Expira em** diz-lhe durante quanto tempo o resultado guardado se mantém: 24 horas numa execução em direto, mais tempo nas execuções agendadas. Quando diz **Expirado**, execute o mapa novamente.

Só vê as suas próprias execuções. A página atualiza-se sozinha enquanto uma execução decorre.

---

# Exportações

A página **Exportações** lista os ficheiros que pediu. Use-a para voltar a transferir um ficheiro.

![A página Exportações com a lista de exportações e um botão Transferir nas concluídas.](shots/pt-PT/user/44-exports.png)

| Controlo | O que faz |
|---|---|
| Tabela | **Mapa**, **Formato** (XLSX, CSV, PDF), **Estado** (**Em fila**, **Em execução**, **Concluída**, **Falhada**), **Linhas**, **Criado**. Passe o cursor sobre **Falhada** para ler porquê |
| Ícone **Transferir** | Transfere um ficheiro concluído |

> **Nota:** Os ficheiros são mantidos durante 7 dias, não para sempre. Se uma transferência falhar, faça a exportação novamente a partir do visualizador. A transferência também falha se o seu acesso de exportação ao mapa tiver sido removido.

Não pode criar exportações aqui. Crie-as no visualizador, em **Execuções** ou no histórico de um agendamento.

---

# Agendamentos

A página **Agendamentos** executa um mapa automaticamente a horas definidas e guarda os resultados. Use-a para relatórios de que precisa todos os dias, semanas ou meses.

Pode agendar um mapa de que é proprietário, ou que é partilhado consigo como **Pode exportar** ou **Pode editar**. Um mapa público ou uma partilha **Pode ver** não podem ser agendados. Um agendamento é executado como si, com o seu acesso aos dados.

![A página Agendamentos com um agendamento em pausa e os respetivos ícones de ação.](shots/pt-PT/user/38-schedules-list.png)

| Controlo | O que faz |
|---|---|
| **Novo Agendamento** | Abre a caixa de diálogo para criar um |
| Tabela | **Nome**, **Mapa**, **Agendamento**, **Próxima Execução**, **Formato**, **Estado** (**Ativo** ou **Em pausa**), **Planeador** |
| Ícone de reprodução (**Executar agora**) | Inicia uma execução de imediato. Desativado enquanto está em pausa |
| Ícone **Pausar** / **Ativar** | Pára ou reinicia o agendamento |
| Ícone **Histórico** | Mostra as últimas 50 execuções |
| Ícone **Editar** | Abre **Editar Agendamento**. O mapa não pode ser alterado |
| Ícone **Eliminar** | Elimina o agendamento e o respetivo histórico. Não pode ser anulado |

A coluna **Planeador** é preenchida nos agendamentos migrados do Oracle Discoverer. Diz se o agendamento migrado pôde ser planeado. Não a pode alterar. **Não verificado** significa que nada foi registado.

## Novo Agendamento

1. Clique em **Novo Agendamento**. Também pode clicar no ícone do calendário em **Mapas**, e o mapa já vem escolhido.
2. Escolha o **Mapa**. A lista mostra os seus mapas e os mapas partilhados consigo, marcados com "(partilhado)". Um mapa partilhado consigo como **Pode ver** não está na lista, porque esse nível não permite um agendamento.
3. Escreva um **Nome**.
4. Escolha uma **Frequência**, um **Fuso horário** e um **Formato de Saída**.
5. Preencha as **Predefinições de parâmetros** se o mapa tiver parâmetros.
6. Deixe **Ativado** assinalado e clique em **Guardar**.

![A caixa de diálogo Novo Agendamento preenchida, com frequência mensal e Ativado desmarcado.](shots/pt-PT/user/37-schedule-filled.png)

| Campo | O que significa / quando escolher |
|---|---|
| **Frequência**: **Diariamente (meia-noite)** | Todos os dias às 00:00 no fuso horário escolhido |
| **Frequência**: **Semanalmente (domingo, meia-noite)** | Todos os domingos às 00:00 |
| **Frequência**: **Mensalmente (dia 1, meia-noite)** | No dia 1 de cada mês às 00:00 |
| **Frequência**: **Personalizado** | Escreve uma **Expressão cron**, com cinco campos: minuto, hora, dia do mês, mês, dia da semana. Por exemplo, `0 9 * * 1-5` é às 09:00 nos dias úteis |
| **Fuso horário** | O relógio usado pelo agendamento. UTC é o predefinido |
| **Válido a partir de (opcional)**, **Válido até (opcional)** | O agendamento não é executado antes nem depois destas datas |
| **Formato de Saída**: **Excel (.xlsx)** ou **CSV** | O tipo de ficheiro do resultado guardado. CSV é o predefinido |
| **Predefinições de parâmetros** | Os valores usados em cada execução. Os obrigatórios estão marcados com * |
| **Ativado** | Se estiver desmarcado, o agendamento espera até o ativar |

## Histórico

**Histórico** mostra **Executado**, **Estado** (**SUCCESS**, **FAILED**, **TIMEOUT**), **Linhas** e **Duração**. Para cada resultado, **Abrir** mostra-o, e **XLSX**, **CSV** e **PDF** criam um ficheiro (se o seu acesso permitir exportar). **Expira** diz durante quanto tempo o resultado se mantém, 30 dias por predefinição.

Os resultados ficam no servidor. Nada é enviado por e-mail.

---

# Definições

As **Definições** alteram o aspeto da aplicação para si. Abra-as na barra lateral ou a partir do seu nome no canto superior direito. As definições pertencem à sua conta e acompanham-no noutros computadores.

![A página Definições com os cartões Idioma de exibição, Aparência e Paleta.](shots/pt-PT/common/04-settings.png)

| Controlo | O que faz |
|---|---|
| **Idioma de exibição** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Aparência** | **Claro**, **Escuro**, **Alto contraste** |
| **Paleta** | **Clássica**, **Azul-marinho**, **Floresta**, **Vinho**, **Oceano**, **Ocre**. Não disponível com **Alto contraste** |
| **Guardar** | Guarda as suas escolhas na sua conta |

As suas escolhas aparecem de imediato. Só ficam guardadas em todos os dispositivos depois de clicar em **Guardar**.

---

# Perguntas frequentes

**Não consigo ver um mapa que um colega vê.** Os mapas são visíveis se for o proprietário, se forem públicos, ou se tiverem sido partilhados consigo. Estar na mesma área de negócio não chega. Peça ao proprietário que o partilhe. Um gestor ou administrador vê todos os mapas, por isso o seu colega pode ter outra função.

**Abri um mapa e a execução diz "Sem autorização para executar".** Pode ver o mapa, mas não tem acesso aos dados de uma das suas pastas. Peça ao seu administrador acesso a essa área de negócio.

**Cliquei em Excel e apareceu "Falha na exportação" ou "Forbidden".** O mapa é partilhado consigo como **Pode ver**. Peça ao proprietário **Pode exportar**.

**Não consigo guardar o meu mapa novo.** Guardar exige o direito de criar na área de negócio do mapa. Fale com o seu administrador.

**O ícone Editar não aparece.** Só pode alterar os seus próprios mapas e os mapas partilhados como **Pode editar**. Copie o mapa e edite a sua cópia.

**Não consigo agendar um mapa.** Tem de ser o proprietário, ou ter **Pode exportar** ou **Pode editar**. Os mapas públicos não podem ser agendados.

**O meu resultado diz Expirado.** Os resultados em direto mantêm-se 24 horas. Execute o mapa novamente.

**Não encontro uma exportação antiga.** Os ficheiros são removidos ao fim de 7 dias. Exporte novamente.

**Esqueci-me da palavra-passe.** Peça ao seu administrador que a reponha.

**Não vejo Áreas de Negócio, Utilizadores ou Migração.** Estas páginas são para outras funções.

---

# Glossário

| Termo | Significado |
|---|---|
| Mapa | Um relatório. No Oracle Discoverer era uma folha de cálculo |
| Livro | Um grupo de mapas |
| Área de negócio | Um grupo de dados relacionados. O seu administrador dá-lhe direitos sobre ela |
| Pasta | Um conjunto de itens relacionados dentro de uma área de negócio, como uma tabela |
| Item | Um campo. Uma dimensão é uma etiqueta, uma medida é um número que se soma |
| Execução | Uma execução de um mapa que produz um resultado |
| Exportação | Um ficheiro (Excel, CSV ou PDF) feito a partir de um resultado |
| Agendamento | Um horário que executa um mapa automaticamente e guarda o resultado |
| Partilha | Dar a outro utilizador acesso a um mapa de que é proprietário: **Pode ver**, **Pode exportar** ou **Pode editar** |
| Mapa público | Um mapa que qualquer utilizador pode abrir, executar e exportar. Não pode ser agendado por outras pessoas |
| Parâmetro | Um valor que o mapa pede quando o executa |
| Expressão cron | Cinco campos que dizem quando um agendamento é executado |
