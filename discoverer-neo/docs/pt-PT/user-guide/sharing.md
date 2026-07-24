# Partilhar Mapas

Saiba como partilhar mapas com colegas e gerir permissões.

## Porquê Partilhar Mapas?

Partilhe mapas para:
- Colaborar no desenvolvimento de relatórios
- Dar aos colegas acesso a consultas comuns
- Delegar a manutenção noutros utilizadores
- Criar modelos para reutilização pela equipa

## Partilhar um Mapa

### Passo 1: Abrir o Mapa

1. Clique em **Mapas** → selecione o seu mapa
2. Clique em **Partilhar** ou **Gerir Partilha**

### Passo 2: Adicionar Utilizador

No painel de partilha:

1. Clique em **+ Adicionar Utilizador** ou **+ Conceder Acesso**
2. Selecione um utilizador na lista
3. Escolha o nível de permissão (ver abaixo)
4. Clique em **Conceder**

O utilizador pode agora aceder ao mapa com o nível de permissão selecionado.

## Níveis de Permissão

| Permissão | Ver | Editar | Eliminar | Exportar | Executar | Partilhar |
|-----------|------|------|--------|--------|-----|-------|
| **Ver** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **Editar** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Exportar** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **Ver** — Pode ver a definição do mapa e executá-lo (só de leitura)
- **Editar** — Pode modificar o mapa e partilhá-lo com outros
- **Exportar** — Pode executar o mapa e exportar os resultados
- **Proprietário** — O utilizador (pode sempre modificar, partilhar e eliminar)

## Público vs. Privado

Alterne **Público** para tornar um mapa detetável por todos os utilizadores:

- **Privado** (predefinição) — Partilhado apenas com utilizadores específicos
- **Público** — Todos os utilizadores autenticados podem vê-lo e executá-lo

## Alterar Permissões

Para alterar o nível de acesso de um utilizador:

1. Encontre o utilizador na lista de partilha
2. Clique na lista pendente de permissões
3. Selecione o novo nível
4. As alterações produzem efeito de imediato

## Revogar Acesso

Para remover o acesso de um utilizador:

1. Encontre o utilizador na lista de partilha
2. Clique em **Remover** ou no ícone de lixo
3. Confirme a remoção

O utilizador perde o acesso de imediato.

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
