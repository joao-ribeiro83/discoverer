# Introdução ao Discoverer Neo

Saiba como iniciar sessão e navegar na interface do Discoverer Neo.

## Aceder ao Discoverer Neo

1. Abra o seu navegador e aceda ao URL do Discoverer Neo (p. ex., `http://localhost:5173` para desenvolvimento)
2. Deverá surgir o ecrã de início de sessão

## Iniciar Sessão

**Ecrã de início de sessão:**
- **E-mail:** O seu endereço de e-mail
- **Palavra-passe:** A sua palavra-passe (fornecida pelo administrador)

Introduza as suas credenciais e clique em **Iniciar sessão**.

**Primeira vez?** Contacte o administrador para criar uma conta.

## Primeiro início de sessão com uma palavra-passe temporária

Se a sua conta foi transferida do Oracle Discoverer, o administrador dar-lhe-á uma
**palavra-passe temporária**. É uma cadeia aleatória de 16 caracteres, por
exemplo `ufNnRksjgR7U%M6X`.

1. Inicie sessão com o seu endereço de e-mail e a palavra-passe temporária.
2. É levado diretamente para **Alterar a palavra-passe** — não pode ignorar este
   passo. Até escolher uma palavra-passe, o resto da aplicação está indisponível.
3. Introduza novamente a palavra-passe temporária e depois a nova duas vezes.
4. Chega ao painel, e a palavra-passe temporária deixa de funcionar de imediato.

A nova palavra-passe tem de ter **pelo menos 12 caracteres** e ser diferente da
temporária.

> **Dica:** a palavra-passe temporária evita deliberadamente caracteres fáceis de
> confundir — sem `O` maiúsculo nem zero, sem `l` minúsculo nem um. Se um
> caractere lhe parecer ambíguo, não é nenhum desses.

Se escrever a palavra-passe temporária incorretamente, o ecrã indica-o e nada é
alterado; peça ao administrador que a redefina se a tiver perdido.

## Interface Principal

Após iniciar sessão, é apresentado o painel principal com as seguintes secções:

### Navegação

**Barra lateral esquerda:**
- **Painel** — Visão geral e ações rápidas
- **Áreas de Negócio** — Coleções organizadas de dados
- **Mapas** — Consultas e relatórios guardados que criou
- **Partilhado Comigo** — Mapas que outros utilizadores partilharam consigo
- **Definições** — Personalizar as preferências de idioma e tema
- **Administração** (se tiver privilégios de administrador) — Gestão do sistema

### Painel

O painel apresenta:
- **Mapas Recentes** — Os mapas que visualizou ou executou recentemente
- **Estatísticas Rápidas** — Número de mapas, execuções e itens partilhados
- **Tarefas Agendadas** — Execuções agendadas ativas e futuras

## Explorar Áreas de Negócio

Uma **Área de Negócio** é um agrupamento lógico de dados e consultas relacionados.

1. Clique em **Áreas de Negócio** na barra lateral
2. É apresentada uma lista das áreas a que tem acesso
3. Clique numa área de negócio para explorar o respetivo conteúdo:
   - **Pastas** — Tabelas/vistas disponíveis nesta área
   - **Itens** — Colunas/campos dentro das pastas
   - **Junções** — Relações entre pastas
   - **Mapas Existentes** — Consultas já criadas para esta área

## Os Seus Mapas

### Ver os Seus Mapas

1. Clique em **Mapas** na barra lateral
2. Surgem dois separadores:
   - **Os Meus Mapas** — Mapas que criou
   - **Partilhado Comigo** — Mapas que outros partilharam consigo

### Criar um Novo Mapa

Consulte [Criar Mapas](building-maps.md).

### Ver Detalhes do Mapa

Clique em qualquer mapa para ver:
- Definição do mapa (itens selecionados, filtros, parâmetros)
- Histórico de execução
- Permissões de partilha

## Navegar na Ajuda

- **Passe o cursor sobre os ícones** para ver sugestões
- **Procure ícones "?"** para obter ajuda específica de cada campo
- **Consulte as mensagens de erro em linha** para obter feedback de validação

## O Que Se Segue?

- **[Definições](settings.md)** — Personalizar idioma e tema
- **[Criar Mapas](building-maps.md)** — Crie a sua primeira consulta
- **[Executar Mapas](executing-maps.md)** — Execute mapas e visualize resultados
- **[Exportar Dados](exporting-data.md)** — Transfira resultados em Excel ou CSV
- **[Agendar Mapas](scheduling.md)** — Automatize a geração de relatórios

---

**Consulte Também:** [Guia do Utilizador](../user-guide/), [Referência da API](../../api/endpoints.md)
