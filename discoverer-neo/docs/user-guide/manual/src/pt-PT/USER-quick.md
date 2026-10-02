# A sua função numa página

Tem a função **USER**. Um **mapa** é um relatório. Uma **área de negócio** é um grupo de dados relacionados.

| Pode | Não pode |
|---|---|
| Ver os seus mapas, os públicos e os partilhados | Ver os mapas privados de outras pessoas |
| Executar mapas, e exportá-los ou agendá-los quando o nível de partilha o permite | Exportar um mapa partilhado como **Pode ver** |
| Copiar um mapa e editar a sua cópia | Alterar mapas de que não é proprietário, exceto se partilhados como **Pode editar** |
| Criar mapas onde tem o direito de criar | Criar mapas noutras áreas de negócio |
| Partilhar e eliminar os seus próprios mapas | Partilhar ou eliminar mapas de outras pessoas |
| Alterar o seu idioma e o tema | Abrir as páginas de administração |

Níveis de partilha: **Pode ver** = só executar. **Pode exportar** = executar, exportar, agendar. **Pode editar** = tudo isso e ainda alterar o mapa.

Inicie sessão com **Email** e **Palavra-passe** e clique em **Iniciar sessão**. Uma palavra-passe temporária tem de ser alterada primeiro (com pelo menos 12 caracteres). Para sair, clique no seu nome e depois em **Terminar sessão**.

![A página de início de sessão com Email, Palavra-passe, Manter sessão iniciada e o botão Iniciar sessão.](shots/pt-PT/common/01-login.png)

---

# Painel

A primeira página depois de iniciar sessão. É só de leitura.

![O painel com os cartões de resumo e a lista Mapas Recentes.](shots/pt-PT/user/45-dashboard.png)

1. Leia **Total de Mapas** e **Total de Execuções** para ter um resumo.
2. Leia **Mapas Agendados** e **Resultados Agendados** para ver os seus agendamentos. Clique em **Ver agendamentos** para os abrir.
3. Clique num mapa em **Mapas Recentes** (os seus últimos 5) para o abrir no construtor.

---

# Mapas

A lista dos seus relatórios. Separadores: **Meus**, **Partilhado comigo**, **Todos**.

![A lista de Mapas, separador Meus, com os ícones de ação na linha do mapa.](shots/pt-PT/user/03-maps-mine.png)

1. Procure pelo nome ou escolha uma **Área de Negócio**.
2. Clique no ícone do olho para abrir o visualizador.
3. Clique no ícone Copiar para fazer a sua própria cópia.
4. Clique no ícone Partilhar (nos seus próprios mapas) para dar acesso.
5. Clique em **Criar Mapa** para construir um novo.

| Ícone | Utilização |
|---|---|
| Olho | Abrir e executar |
| Lápis | Editar (próprio ou **Pode editar**) |
| Copiar | A sua própria cópia |
| Partilhar | Defina **Pode ver**, **Pode exportar**, **Pode editar**, ou **✕** para remover |
| Calendário | Agendar (próprio, **Pode exportar**, **Pode editar**) |
| Lixo | Eliminar (só os seus, e só um administrador o pode restaurar) |

---

# Executar e exportar

O visualizador executa um mapa e mostra as linhas.

![O visualizador de mapas depois de uma execução concluída, com a grelha de resultados e os botões de exportação.](shots/pt-PT/user/25-viewer-results.png)

1. Abra o mapa com o ícone do olho.
2. Clique em **Executar**. Preencha os **Parâmetros de execução** se lhe forem pedidos.
3. Leia os resultados. Clique num cabeçalho para ordenar e faça duplo clique numa linha para **Ver Detalhe**.
4. Clique em **Excel**, **CSV** ou **PDF** para exportar.
5. Clique em **Executar novamente** para obter dados atualizados. Um resultado mantém-se válido durante 24 horas.

| Escolha | Linha |
|---|---|
| Caixa de diálogo **PDF** | Escolha o **Tamanho do papel** (A4, A3, Carta), a **Orientação** e as colunas |
| **Sem autorização para executar** | Não tem acesso aos dados. Fale com o seu administrador |
| **Forbidden** ao exportar | O mapa está só como **Pode ver**. Peça **Pode exportar** |

---

# Construir e editar um mapa

Construa um mapa a partir de itens de uma só área de negócio. Só onde tem o direito de criar.

![O construtor de mapas com a árvore Áreas de Negócio, a área de Colunas e o painel Propriedades.](shots/pt-PT/user/05-builder-overview.png)

1. Clique em **Criar Mapa**.
2. Arraste itens da árvore **Áreas de Negócio** para **Colunas**. O primeiro item define a área de negócio.
3. Defina filtros em **Condições**, a ordenação em **Ordenação** e os pedidos em **Parâmetros**.
4. Escreva um nome e clique em **Guardar**. Nada é guardado automaticamente.
5. Clique em **Executar** para testar.

| Separador | Utilização |
|---|---|
| **Propriedades** | Descrição e caixa **Público** (visível para todos os utilizadores) |
| **Condições** | Filtros, fixos ou **Pedir em tempo de execução** |
| **Ordenação** | Níveis de ordenação |
| **Parâmetros** | Valores pedidos no momento da execução |
| **Campos Calculados** | Nova coluna a partir de uma fórmula |

**Formatação** colore as células que cumprem uma regra. Precisa de um mapa guardado.

---

# Execuções e Exportações

**Execuções** lista as suas execuções. **Exportações** lista os seus ficheiros.

![A página Execuções com os filtros e a tabela de execuções com os respetivos botões de exportação.](shots/pt-PT/user/41-runs.png)

1. Abra **Execuções** para ver o estado, as linhas e **Expira em**.
2. Clique em **Abrir** para ver um resultado guardado, ou em **Executar novamente**.
3. Clique em **XLSX**, **CSV** ou **PDF** para transferir um resultado.
4. Abra **Exportações** e clique em **Transferir** num ficheiro concluído.

| Escolha | Linha |
|---|---|
| **Cancelar** | Só para uma execução em fila |
| **Eliminar** | Remove a execução de forma definitiva |
| Ficheiros | Mantidos durante 7 dias |

![A página Exportações com a lista de exportações e um botão Transferir nas concluídas.](shots/pt-PT/user/44-exports.png)

---

# Agendamentos

Executa um mapa automaticamente e guarda o resultado no servidor. Nada é enviado por e-mail.

![A caixa de diálogo Novo Agendamento com mapa, nome, frequência, fuso horário e formato de saída.](shots/pt-PT/user/32-schedule-new-dialog.png)

1. Clique em **Novo Agendamento**, ou no ícone do calendário em **Mapas**.
2. Escolha o **Mapa** (próprio, ou partilhado como **Pode exportar** ou **Pode editar**).
3. Escreva um **Nome**.
4. Escolha a **Frequência**, o **Fuso horário** e o **Formato de Saída**.
5. Preencha as **Predefinições de parâmetros** e clique em **Guardar**.
6. Use **Executar agora**, **Pausar**, **Histórico** para o gerir.

| Escolha | Linha |
|---|---|
| **Frequência** | **Diário**, **Semanal**, **Quinzenal**, **Mensal**, a cada 2, 3, 4 ou 6 meses, **Anual**, com uma **Hora** e um dia; ou **Personalizado (cron)** |
| **Predefinições de parâmetros** | **Valor fixo**, ou **Relativo à data de execução**: -1 **meses**, **último dia desse mês** é o fim do mês passado |
| **Formato de Saída** | **Excel (.xlsx)** ou **CSV** |
| Mapa público | Não pode ser agendado |

---

# Definições

Abra **Definições** na barra lateral.

![A página Definições com os cartões Idioma de exibição, Aparência e Paleta.](shots/pt-PT/common/04-settings.png)

1. Escolha um **Idioma de exibição**.
2. Escolha **Claro**, **Escuro** ou **Alto contraste**.
3. Escolha uma **Paleta** (não disponível com **Alto contraste**).
4. Clique em **Guardar**. Sem isso, a escolha fica apenas neste navegador.
