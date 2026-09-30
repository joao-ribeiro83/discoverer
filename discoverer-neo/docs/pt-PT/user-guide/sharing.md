# Partilhar Mapas

Saiba como partilhar mapas com colegas e gerir permissões.

## Porquê Partilhar Mapas?

Partilhe mapas para:
- Colaborar no desenvolvimento de relatórios
- Dar aos colegas acesso a consultas comuns
- Delegar a manutenção noutros utilizadores
- Criar modelos para reutilização pela equipa

## Partilhar um Mapa

### Quem pode partilhar

- O **proprietário** do mapa
- Um **MANAGER** — qualquer mapa
- Um **ADMIN** — qualquer mapa

Um utilizador que recebeu um mapa, mesmo com EDIT, não pode passá-lo a outros.

### Passo 1: Abrir a janela de partilha

1. Clique em **Mapas**
2. Clique no ícone de partilha na linha do mapa, ou num livro para partilhar
   todas as folhas que contém

### Passo 2: Escolher pessoas e níveis

A janela lista todos os utilizadores. As pessoas que já têm o mapa aparecem primeiro.

1. Escreva na caixa de filtro para encontrar alguém (opcional)
2. Clique num nível junto ao nome: **Pode ver**, **Pode exportar** ou
   **Pode editar**. Pause o cursor sobre um nível para ver o que permite.

O botão escuro é o nível que a pessoa tem agora. Clique noutro nível para o
alterar. Clique em **✕** para lhe retirar o mapa.

## Níveis de Permissão

| Permissão | Ver | Editar | Eliminar | Exportar | Executar | Partilhar |
|-----------|------|------|--------|--------|-----|-------|
| **Ver** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **Editar** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Exportar** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **Ver** — Pode ver a definição do mapa e executá-lo (só de leitura)
- **Editar** — Pode executar, exportar, agendar e alterar o mapa (não o pode partilhar)
- **Exportar** — Pode executar o mapa, exportar os resultados e agendá-lo
- **Proprietário** — O utilizador (pode sempre modificar, partilhar e eliminar)

## Público vs. Privado

Alterne **Público** para tornar um mapa detetável por todos os utilizadores:

- **Privado** (predefinição) — Partilhado apenas com utilizadores específicos
- **Público** — Todos os utilizadores autenticados podem vê-lo e executá-lo

## Alterar ou Revogar Acesso

Na janela de partilha, clique noutro nível para o alterar, ou em **✕** para o
remover. A alteração produz efeito de imediato.

Um ADMIN ou MANAGER também o pode fazer em **Utilizadores** → ícone de mapa na
linha de um utilizador. Essa lista mostra todos os mapas que o utilizador pode
abrir, com o respetivo proprietário. Aí pode alterar o nível de uma partilha,
removê-la ou atribuir o mapa a um novo proprietário.

## Copiar um Mapa

Qualquer pessoa, exceto um VIEWER, pode copiar um mapa que consiga ver: clique
no ícone de cópia na linha do mapa em **Mapas**. A cópia é sua, por isso pode
alterá-la. Executá-la continua a exigir uma permissão na área de negócio do mapa.

## Partilhado Comigo

Para ver os mapas partilhados consigo:

1. Clique em **Mapas** na barra lateral
2. Clique no separador **Partilhado Comigo**
3. Percorra os mapas partilhados

Pode:
- **Ver** — Consultar a definição do mapa
- **Executar** — Executar o mapa com AS SUAS permissões na área de negócio
- **Exportar** — Guardar os resultados em Excel/CSV (se a permissão Exportar for concedida)
- **Editar** — Modificar (se a permissão Editar for concedida)

## Melhores Práticas de Partilha

### Convenções de Nomenclatura

Utilize nomes descritivos para os mapas partilhados:
- ✓ "Relatório Semanal de Vendas - Região EMEA"
- ✗ "Relatorio1"

### Níveis de Permissão

Conceda a permissão mínima necessária:
- **Ver** para relatórios só de leitura
- **Editar** apenas a colegas de confiança que mantêm o mapa
- **Exportar** aos utilizadores que precisam dos dados mas não de alterar o mapa

### Documentação

Adicione descrições aos mapas partilhados:
1. Edite o mapa
2. Atualize o campo **Descrição**
3. Explique o que o mapa mostra, o significado dos parâmetros e o agendamento de atualização dos dados

**Exemplo:**
```
Relatório de Vendas por Região

Mostra o total de vendas por região para o período selecionado.
Parâmetros:
- start_date: Data de início do relatório (predefinição: primeiro dia do mês atual)
- end_date: Data de fim do relatório (predefinição: hoje)

Atualizado diariamente às 9h UTC.
Contacto: sales-analytics@example.com para questões.
```

### Controlo de Versões

Para mapas partilhados críticos:
- Indique o número da versão na descrição
- Ao efetuar alterações importantes, incremente a versão
- Informe os utilizadores sobre alterações que quebrem a compatibilidade

## Partilhar Entre Áreas de Negócio

Partilhe mapas apenas em áreas de negócio onde os destinatários tenham acesso **Ver**:

- **Se não tiverem Ver:** Não conseguem executar o mapa, mesmo que este seja partilhado
- **Se não tiverem Editar:** Não conseguem modificá-lo, mesmo com partilha Editar

Contacte o administrador para conceder primeiro acesso à área de negócio.

## Fluxo de Trabalho de Colaboração

**Cenário: Criar um relatório em conjunto**

1. O **Utilizador A** cria um rascunho de mapa
2. O **Utilizador A** partilha-o com o **Utilizador B** com a permissão **Editar**
3. O **Utilizador B** executa o mapa e sugere alterações
4. O **Utilizador A** edita o mapa
5. O **Utilizador B** verifica as alterações
6. O **Utilizador A** torna-o **Público** ou concede acesso **só de Ver** a uma equipa maior

## Resolução de Problemas

### "Utilizador não encontrado"

- O utilizador não existe no sistema
- Contacte o administrador para criar a conta de utilizador

### "Permissões insuficientes para executar"

- Tem partilha Editar, mas não tem Ver na área de negócio
- Contacte o administrador para obter acesso à área de negócio

### "Não é possível partilhar com este utilizador"

- A função do utilizador (p. ex., VIEWER) pode restringir determinadas ações
- Contacte o administrador

## O Que Se Segue?

- **[Agendar Mapas](scheduling.md)** — Automatize a distribuição de relatórios partilhados
- **[Criar Mapas](building-maps.md)** — Crie mapas para partilhar
- **[Guia do Administrador - Utilizadores](../admin-guide/user-management.md)** — Gerir contas de utilizador

---

**Consulte Também:** [Guia do Utilizador](../user-guide/), [Referência da API - Partilhas](../../api/endpoints.md#map-shares)
