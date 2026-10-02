# A sua função numa página

É um **Manager**. Vê, executa, exporta, agenda e partilha todos os mapas, e cuida das contas Manager, User e Viewer. Não altera o modelo de dados, as funções personalizadas nem as origens de dados. Isso é trabalho de um administrador.

| Pode | Não pode |
|---|---|
| Ver, executar, exportar e agendar todos os mapas | Alterar ou eliminar um mapa de que não é proprietário (exceto se for partilhado consigo como **Pode editar**) |
| Partilhar qualquer mapa e alterar qualquer partilha | Ver o SQL ou o plano da base de dados |
| Copiar qualquer mapa para criar o seu | Criar ou eliminar utilizadores, dar a função ADMIN, nem dar permissões |
| Atribuir um mapa a um novo proprietário | Ver as execuções, exportações ou agendamentos de outras pessoas |
| Editar, ativar e desativar as contas Manager, User e Viewer | Ver ou alterar contas de administrador |
| Criar mapas nas áreas de negócio em que tem uma permissão | Alterar áreas de negócio, pastas, itens, junções, hierarquias, funções personalizadas ou origens de dados |

> **Nota:** **Áreas de Negócio**, **Pastas**, **Itens**, **Junções**, **Hierarquias**, **Funções Personalizadas**, **Origens de Dados**, **Segurança**, **Registo de Auditoria** e **Migração** são só para administradores. Não aparecem na sua barra lateral.

Ver um mapa não lhe dá os respetivos dados. Uma execução precisa de uma permissão de área de negócio em cada pasta que o mapa usa. Sem ela, aparece **Sem autorização para executar**.

Inicie sessão com o seu **Email** e **Palavra-passe** e clique em **Iniciar sessão**. Termine a sessão no menu do seu nome com **Terminar sessão**.

---

# Mapas

A página **Mapas** lista todos os mapas. Um mapa é um relatório (uma folha de cálculo no Oracle Discoverer).

![A lista de Mapas, separador Todos, com os ícones Copiar, Partilhar, Agendar e Exportar em cada linha.](shots/pt-PT/manager/02-maps-all.png)

1. Escolha um separador: **Meus**, **Partilhado comigo** ou **Todos**.
2. Reduza a lista com **Procurar mapas por nome…** ou com o filtro **Área de Negócio**.
3. Clique no ícone do olho para abrir um mapa e executá-lo.
4. Clique no ícone Copiar para fazer a sua própria cópia. Fica privada, só para si.
5. Clique no ícone Partilhar para dar acesso a alguém.

| Ícone | O que faz |
|---|---|
| Lápis | Altera o mapa. Só nos seus próprios mapas ou em partilhas **Pode editar**. |
| Lixo | Elimina. Só os seus próprios mapas. Um administrador tem de o restaurar. |
| Calendário | Agenda este mapa. |

---

# Partilhar um mapa

A partilha decide o que outra pessoa pode fazer com um mapa.

![A caixa de diálogo Partilhar mapa com uma caixa de pesquisa e os botões Pode ver, Pode exportar e Pode editar.](shots/pt-PT/manager/03-share-dialog.png)

1. Clique no ícone Partilhar do mapa.
2. Procure uma pessoa pelo nome ou e-mail.
3. Clique num nível junto ao nome dessa pessoa. O botão escuro é o nível atual.
4. Clique no X junto a um nome para remover o acesso.

| Nível | O que significa |
|---|---|
| **Pode ver** | Só abrir e executar. |
| **Pode exportar** | Também exportar e agendar. |
| **Pode editar** | Também alterar o mapa. |

---

# Ver, executar e exportar

O visualizador executa um mapa e mostra as respetivas linhas. Nunca altera o mapa.

![Uma execução concluída com os botões Excel, CSV e PDF por cima da grelha de resultados.](shots/pt-PT/viewer/06-viewer-results.png)

1. Abra o mapa com o ícone do olho.
2. Clique em **Executar**. Responda às perguntas dos **Parâmetros de execução**, se aparecerem.
3. Leia as linhas. Clique num cabeçalho para ordenar. Faça duplo clique numa linha para ver as linhas de origem.
4. Clique em **Excel**, **CSV** ou **PDF** para exportar.
5. Encontre o ficheiro mais tarde em **Exportações**. Os ficheiros são mantidos durante 7 dias.

Um resultado mantém-se válido durante 24 horas. **Executar novamente** força uma nova execução.

---

# Construtor de mapas

Use o construtor para criar ou alterar um mapa. Só pode guardar um mapa novo com uma permissão CREATE na respetiva área de negócio. Só pode guardar um mapa existente se for o proprietário ou tiver **Pode editar**. Para alterar o mapa de outra pessoa, copie-o primeiro.

![O construtor de mapas com a árvore Áreas de Negócio, a área de Colunas e o painel Propriedades.](shots/pt-PT/user/05-builder-overview.png)

1. Clique em **Criar Mapa**, ou no ícone do lápis num mapa seu.
2. Arraste itens da árvore **Áreas de Negócio** para **Colunas**. Todas as colunas têm de vir de uma só área de negócio.
3. Clique numa coluna para definir a **Agregação**, a **Direção de ordenação** ou a **Máscara de Formato**.
4. Use os separadores **Condições**, **Ordenação**, **Parâmetros** e **Campos Calculados** se for preciso.
5. Clique em **Guardar** e depois em **Executar**. Nada é guardado automaticamente.

---

# Agendamentos

Um agendamento executa um mapa num horário definido e guarda o resultado. Só vê os seus próprios agendamentos.

![A página Agendamentos com um agendamento em pausa e os respetivos ícones de ação.](shots/pt-PT/user/38-schedules-list.png)

1. Em **Mapas**, clique no ícone do calendário do mapa. Para agendar o mapa de outra pessoa, use este ícone.
2. Escreva um **Nome**.
3. Escolha a **Frequência**, o **Fuso horário** e o **Formato de Saída**.
4. Clique em **Guardar**.
5. Clique em **Executar agora** para testar. Abra **Histórico** para ver os resultados.

| Escolha | Significado |
|---|---|
| **Diário**, **Semanal**, **Quinzenal**, **Mensal**, a cada 2, 3, 4 ou 6 meses, **Anual** | Horários prontos a usar, com uma **Hora** e um dia. |
| **Personalizado (cron)** | A sua própria expressão cron de cinco campos. |
| **Relativo à data de execução** | Um valor de parâmetro que acompanha a execução, por exemplo -1 **meses**, **último dia desse mês**. |
| **Excel (.xlsx)**, **CSV** | Formato do resultado guardado. |

O agendamento é executado como si, por isso as suas permissões decidem que dados lê.

---

# Execuções e Exportações

**Execuções** lista as suas próprias execuções. **Exportações** lista os seus próprios ficheiros exportados. Não vê os de outras pessoas.

![A página Execuções com os filtros Mapa, Estado e Tipo e a lista de execuções.](shots/pt-PT/manager/08-runs.png)

1. Clique em **Execuções** para ver as execuções em espera, em curso e concluídas.
2. Clique no ícone **Abrir** para ver um resultado guardado. Use **Executar novamente** para o repetir.
3. Clique em **Cancelar** numa execução em fila para a parar.
4. Clique em **Exportações** e depois no ícone **Transferir** numa linha **Concluída**.

---

# Utilizadores

A página **Utilizadores** lista as contas Manager, User e Viewer. Os administradores não aparecem na sua lista. Clique no ícone da linha **Editar** para alterar o nome, o email, a palavra-passe ou a função (MANAGER, USER ou VIEWER) de uma pessoa. Use **Desativar** ou **Ativar** para impedir ou permitir o início de sessão.

Para corrigir o acesso aos mapas:

![A caixa de diálogo Mapas de um utilizador, com listas de nível de partilha e ícones de proprietário e remover.](shots/pt-PT/manager/09-users-maps-dialog.png)

1. Clique no ícone da linha **Mapas que este utilizador pode abrir**.
2. Para alterar um mapa partilhado, use a lista de níveis junto a ele.
3. Para retirar um mapa partilhado, clique no X.
4. Para entregar um mapa, clique no ícone de proprietário e escolha o **Novo proprietário**.

> **Atenção:** O novo proprietário pode alterar, partilhar e eliminar o mapa.

Criar e eliminar utilizadores, e a função ADMIN, são da responsabilidade dos administradores.

---

# Definições

Abra **Definições** na barra lateral ou no menu do seu nome.

![A página Definições com os cartões Idioma de exibição, Aparência e Paleta.](shots/pt-PT/common/04-settings.png)

1. Escolha o **Idioma de exibição**, a **Aparência** e a **Paleta**.
2. Clique em **Guardar**. Sem isso, a escolha não o acompanha noutros computadores.

Para alterar a palavra-passe, abra `/change-password`. Precisa de pelo menos 12 caracteres. Não existe ligação de recuperação. Peça a um administrador se se esquecer dela.
