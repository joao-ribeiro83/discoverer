# Gestão de Utilizadores

Saiba como criar utilizadores, atribuir funções e gerir permissões de áreas de negócio.

## Funções de Utilizador

O Discoverer Neo tem quatro funções de utilizador com capacidades diferentes:

| Função | Capacidades |
|------|-------------|
| **ADMIN** | Acesso total ao sistema — utilizadores, áreas de negócio, origens de dados, registos de auditoria |
| **MANAGER** | Criar e gerir áreas de negócio, conceder permissões a outros utilizadores |
| **USER** | Criar mapas, executar consultas, partilhar mapas com colegas |
| **VIEWER** | Acesso só de leitura a mapas e painéis partilhados |

## Criar Utilizadores

### Adicionar Um Único Utilizador

1. Painel de Administração → **Utilizadores**
2. Clique em **+ Criar Utilizador**
3. Introduza:
   - **E-mail** — Endereço de e-mail único (identificador de início de sessão)
   - **Nome** — Nome completo ou nome de apresentação
   - **Palavra-passe** — Palavra-passe inicial (o utilizador deve alterá-la no primeiro início de sessão)
   - **Função** — ADMIN, MANAGER, USER ou VIEWER
4. Clique em **Criar**

O utilizador recebe uma notificação para iniciar sessão (se o e-mail estiver configurado).

### Importação em Lote

Para migrar muitos utilizadores do Oracle Discoverer:

1. Exporte a lista de utilizadores em CSV:
   ```
   email,name,role
   john@example.com,John Smith,USER
   jane@example.com,Jane Doe,MANAGER
   ```

2. Utilize a ferramenta de migração ou a API para criar em lote

3. Envie um e-mail de boas-vindas com palavras-passe temporárias

## Atribuir Funções

### Alterar a Função de um Utilizador

1. Painel de Administração → **Utilizadores**
2. Clique no utilizador → **Editar**
3. Altere a lista pendente **Função**
4. Clique em **Guardar**

A alteração da função produz efeito de imediato.

## Permissões de Áreas de Negócio

Depois de os utilizadores existirem, conceda-lhes acesso a áreas de negócio específicas.

### Conceder Permissão

1. Painel de Administração → **Áreas de Negócio**
2. Selecione a área de negócio → **Gerir Acesso**
3. Clique em **+ Conceder Permissão**
4. Selecione:
   - **Utilizador** — A partir da lista pendente
   - **Nível de Permissão** — Criar, Editar, Eliminar, Exportar, Agendar ou Ver
5. Clique em **Conceder**

**Níveis de Permissão numa Área de Negócio:**

| Permissão | Mapas | Metadados | Agendar | Exportar |
|-----------|------|----------|----------|--------|
| **Criar** | Criar novos mapas | ✗ | ✗ | ✗ |
| **Editar** | Modificar mapas | ✗ | ✗ | ✗ |
| **Eliminar** | Eliminar mapas | ✗ | ✗ | ✗ |
| **Exportar** | Exportar resultados | ✓ | ✗ | ✓ |
| **Agendar** | Criar agendamentos | ✓ | ✗ | ✓ |
| **Ver** | Executar/ver mapas | ✓ | ✓ | ✗ |

### Conceder Várias Permissões

Normalmente, os utilizadores precisam de várias permissões:

- **Utilizadores de Dados:** Ver + Exportar (podem executar mapas e transferir)
- **Criadores de Relatórios:** Ver + Criar + Editar (podem criar e testar)
- **Publicadores:** Criar + Editar + Exportar + Agendar (ciclo de vida completo do mapa)

### Revogar Permissão

1. Clique na área de negócio → **Gerir Acesso**
2. Encontre o utilizador na lista de permissões
3. Clique em **Remover**
4. Confirme

O utilizador perde o acesso de imediato.

### Alterar o Nível de Permissão

1. Clique na área de negócio → **Gerir Acesso**
2. Encontre o utilizador
3. Clique na lista pendente de permissões
4. Selecione o novo nível
5. A alteração produz efeito de imediato

## Gestão de Palavras-passe

### Palavras-passe Iniciais

Os novos utilizadores recebem palavras-passe iniciais. Melhor prática:

1. Defina uma palavra-passe temporária (p. ex., "TempPassword123!")
2. Instrua o utilizador a alterá-la no primeiro início de sessão
3. O utilizador inicia sessão, clica em **Perfil** → **Alterar Palavra-passe**
4. Introduz a nova palavra-passe

### Redefinição de Palavra-passe

Se o utilizador se esquecer da palavra-passe (na qualidade de administrador):

1. Painel de Administração → **Utilizadores**
2. Clique no utilizador → **Redefinir Palavra-passe**
3. O sistema gera uma palavra-passe temporária
4. Envie-a ao utilizador (por e-mail ou por outro meio)
5. O utilizador altera a palavra-passe no primeiro início de sessão

### Forçar a Alteração da Palavra-passe

Para exigir a alteração da palavra-passe do utilizador:

1. Clique no utilizador → **Editar**
2. Assinale **Forçar Alteração de Palavra-passe no Início de Sessão**
3. Guarde

Será solicitado ao utilizador que altere a palavra-passe no próximo início de sessão.

## Preferências do Utilizador

Os utilizadores podem gerir as suas próprias preferências de interface sem intervenção do administrador:

- **Idioma** — Os utilizadores selecionam o idioma preferido da interface (English, Português, Français, Español) nas Definições
- **Tema** — Os utilizadores escolhem o tema visual preferido (Claro, Escuro, Alto Contraste) nas Definições

Estas preferências são de autosserviço e por utilizador. Cada utilizador pode aceder às Definições através da barra lateral ou do menu pendente de perfil para personalizar a sua experiência. Não é necessária qualquer configuração por parte do administrador.

## Estado do Utilizador

### Ativo/Inativo

Alterne o estado do utilizador:

- **Ativo** — O utilizador pode iniciar sessão
- **Inativo** — O utilizador não pode iniciar sessão (eliminação reversível)

Útil para desativar temporariamente sem eliminar contas.

### Conta Bloqueada

Não existe bloqueio manual de conta na versão atual. Os utilizadores podem repetir a palavra-passe indefinidamente.

Para impedir o início de sessão:
- Defina como **Inativo** (preferível)
- Ou elimine a conta de utilizador

## Delegação

Os gestores podem delegar a criação de utilizadores e a gestão de permissões:

1. Promova os utilizadores à função **MANAGER**
2. Os gestores podem então:
   - Criar utilizadores
   - Conceder permissões nas suas áreas de negócio
   - Gerir o acesso de outros utilizadores

Os gestores não podem:
- Criar outros gestores ou administradores
- Aceder às definições do sistema ou aos registos de auditoria
- Gerir origens de dados

## Trilho de Auditoria

Acompanhe as ações dos utilizadores no **Registo de Auditoria**:

1. Painel de Administração → **Registo de Auditoria**
2. Filtre por:
   - Intervalo de datas
   - Utilizador
   - Ação (CREATE, UPDATE, DELETE, EXECUTE)
   - Tipo de entidade (USER, MAP, BUSINESS_AREA, etc.)

Os eventos de criação/modificação de utilizadores são registados.

## Melhores Práticas

### Convenções de Nomenclatura

Utilize um endereçamento de e-mail consistente:
- ✓ nome.apelido@example.com
- ✓ e-mail do serviço de diretório (LDAP, Active Directory)
- ✗ IDs numéricos (difíceis de identificar)

### Funções Predefinidas

Atribua a função mínima necessária:

- A maioria dos utilizadores → função **USER** (não MANAGER nem ADMIN)
- Criadores de relatórios → função **USER**
- Líderes de equipa → função **MANAGER** (se gerirem áreas de negócio)
- Apenas 1–2 → função **ADMIN**

### Auditorias Regulares

Reveja periodicamente:
- Permissões de utilizador (remova utilizadores inativos)
- Acesso a áreas de negócio (revogue concessões desnecessárias)
- Contas de administrador (garanta que apenas existem as necessárias)

### Lista de Verificação de Integração (Onboarding)

1. ✓ Criar conta de utilizador
2. ✓ Atribuir a função adequada
3. ✓ Conceder permissões de áreas de negócio
4. ✓ Enviar e-mail de boas-vindas com instruções de início de sessão
5. ✓ Agendar uma apresentação para os novos utilizadores

### Lista de Verificação de Saída (Offboarding)

1. ✓ Identificar os mapas de que o utilizador é proprietário
2. ✓ Transferir a propriedade ou arquivar os mapas
3. ✓ Revogar as permissões de áreas de negócio
4. ✓ Definir o utilizador como **Inativo** (ou eliminá-lo)
5. ✓ Registar o evento de auditoria

## Integração com Diretório (Futuro)

As versões futuras poderão suportar LDAP/Active Directory:
- Utilizadores aprovisionados automaticamente a partir do diretório
- Funções/permissões sincronizadas a partir dos grupos do diretório
- Suporte para início de sessão com SSO

## O Que Se Segue?

- **[Políticas de Segurança](security.md)** — Definir segurança ao nível da linha para os utilizadores
- **[Registo de Auditoria](audit-logging.md)** — Rever as atividades dos utilizadores
- **[Gestão de Áreas de Negócio](metadata-management.md)** — Organizar conteúdos

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API - Utilizadores](../../api/endpoints.md#users)
