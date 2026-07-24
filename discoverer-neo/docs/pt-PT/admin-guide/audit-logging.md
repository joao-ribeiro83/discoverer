# Registo de Auditoria

Saiba mais sobre o trilho de auditoria do Discoverer Neo e como rever as atividades do sistema.

## O Que É o Registo de Auditoria?

O **Registo de Auditoria** regista todas as atividades significativas do sistema — alterações de metadados, execuções de mapas, início/fim de sessão de utilizadores, concessão/revogação de permissões e tarefas de exportação.

Cada evento de auditoria inclui:
- **Data/Hora** — Quando ocorreu a atividade
- **Utilizador** — Quem executou a ação
- **Ação** — O que aconteceu (CREATE, UPDATE, DELETE, EXECUTE)
- **Entidade** — O que foi afetado (MAP, BUSINESS_AREA, USER, etc.)
- **Alterações** — Detalhes do que mudou (nas atualizações)

## Aceder aos Registos de Auditoria

### Ver o Registo de Auditoria

1. Painel de Administração → **Registo de Auditoria**
2. Veja a lista paginada de eventos recentes (mais recentes primeiro)
3. Filtre por:
   - **Intervalo de Datas** — Data de início e de fim
   - **Utilizador** — Filtrar por quem executou a ação
   - **Tipo de Entidade** — Filtrar por aquilo que foi afetado
   - **Ação** — CREATE, UPDATE, DELETE, EXECUTE, GRANT, etc.
4. Clique num evento para ver todos os detalhes

### Detalhes do Evento

Ao clicar num evento é apresentado:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-19T12:15:30Z",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "userEmail": "alice@example.com",
  "action": "CREATE",
  "entityType": "MAP",
  "entityId": "550e8400-e29b-41d4-a716-446655440100",
  "entityName": "Q3 Sales Report",
  "changes": {
    "name": "Q3 Sales Report",
    "mapType": "TABLE",
    "businessAreaId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Tipos de Evento

### Alterações de Metadados

| Entidade | Ações |
|--------|---------|
| BUSINESS_AREA | CREATE, UPDATE, DELETE |
| FOLDER | CREATE, UPDATE, DELETE |
| ITEM | CREATE, UPDATE, DELETE |
| JOIN | CREATE, UPDATE, DELETE |
| HIERARCHY | CREATE, UPDATE, DELETE |
| CUSTOM_FUNCTION | CREATE, UPDATE, DELETE |

### Ciclo de Vida do Mapa

| Entidade | Ações |
|--------|---------|
| MAP | CREATE, UPDATE, DELETE, DUPLICATE |
| MAP_EXECUTION | EXECUTE, CANCEL |
| MAP_SHARE | GRANT, REVOKE |

### Gestão de Utilizadores e Permissões

| Entidade | Ações |
|--------|---------|
| USER | CREATE, UPDATE, DELETE |
| BUSINESS_AREA_GRANT | GRANT, REVOKE, UPDATE |
| SECURITY_POLICY | CREATE, UPDATE, DELETE |

### Dados e Tarefas

| Entidade | Ações |
|--------|---------|
| EXPORT | CREATE, START, COMPLETE, FAIL, DELETE |
| SCHEDULE | CREATE, UPDATE, DELETE, EXECUTE |

### Autenticação

| Entidade | Ações |
|--------|---------|
| LOGIN | LOGIN, LOGOUT |
| TOKEN | REFRESH, BLACKLIST |

## Consultas Comuns

### Quem Modificou Este Mapa?

1. Filtre por Tipo de Entidade: MAP
2. Pesquise pelo nome ou ID do mapa
3. Veja os eventos CREATE → UPDATE

### Acompanhar Alterações de Permissões

1. Filtre por Tipo de Entidade: BUSINESS_AREA_GRANT
2. Filtre por Utilizador, se necessário
3. Veja quem concedeu/revogou permissões e quando

### Encontrar Exportações com Falha

1. Filtre por Tipo de Entidade: EXPORT
2. Procure as ações FAIL
3. Verifique os detalhes do erro

### Histórico de Execução

Para as execuções de um mapa específico:

1. Abra o mapa → separador **Histórico** (na página do mapa, não no registo de auditoria)
2. Veja os tempos de execução, as contagens de linhas e o estado

(O registo de auditoria mostra CREATE/UPDATE nos mapas; o histórico de execução mostra os eventos EXECUTE)

### Utilizadores Criados num Intervalo de Datas

1. Filtre por Tipo de Entidade: USER
2. Filtre por Ação: CREATE
3. Filtre por Intervalo de Datas
4. Veja todas as novas contas criadas

## Retenção de Auditoria

Os registos de auditoria são retidos indefinidamente (na base de dados PostgreSQL).

**Cópia de Segurança:** Os registos de auditoria são incluídos nas cópias de segurança da base de dados (consulte o [Guia de Cópia de Segurança](../../deployment/backup.md)).

**Exportação:** Para exportar registos de auditoria para análise:

```bash
# Use API to fetch logs
curl -X GET "http://localhost:3000/api/audit?limit=10000" \
  -H "Authorization: Bearer $TOKEN" > audit-logs.json

# Parse with jq or import to Excel
jq '.data[] | {timestamp, user: .userEmail, action, entity: .entityType}' audit-logs.json
```

## Considerações de Segurança

### Controlo de Acesso

Apenas os utilizadores **ADMIN** podem ver os registos de auditoria. Os não administradores não podem aceder a esta funcionalidade.

### Manipulação do Registo de Auditoria

Os registos de auditoria são apenas de anexação; os eventos não podem ser eliminados nem modificados (exceto a eliminação da totalidade da base de dados, o que não é viável em produção).

### Dados Sensíveis

Os registos de auditoria incluem:
- E-mails e nomes de utilizadores
- Definições de mapas (consultas)
- Nomes/valores de parâmetros (podem incluir datas, regiões)
- Mas NÃO: Palavras-passe da base de dados (armazenadas encriptadas, não registadas)

Tenha cuidado com os registos de auditoria que contenham dados de negócio sensíveis.

## Casos de Utilização

### Auditoria de Conformidade

Acompanhe quem acedeu a que dados e quando:

1. Filtre os eventos EXECUTION
2. Veja que utilizadores executaram que mapas
3. Exporte para uma base de dados de conformidade

### Investigar Problemas

"Este mapa deixou de funcionar a 15 de julho":

1. Analise as atualizações a MAP em torno de 15 de julho
2. Veja quem o alterou e o que mudou
3. Compreenda o impacto

### Monitorização da Atividade dos Utilizadores

"Acompanhar os inícios e fins de sessão dos utilizadores":

1. Filtre por Tipo de Entidade: LOGIN
2. Veja os eventos de autenticação com data/hora
3. Identifique padrões de atividade invulgares

### Auditorias de Permissões

"Quem tem permissão Criar na área Finanças?":

1. Filtre por Tipo de Entidade: BUSINESS_AREA_GRANT
2. Filtre pelo nome de BUSINESS_AREA: Finanças
3. Veja todas as concessões e quem as detém

## Melhores Práticas

1. **Revisão Regular** — Verifique os registos de auditoria semanalmente para detetar anomalias
2. **Faça Cópia de Segurança dos Registos de Auditoria** — Inclua-os nas cópias de segurança da base de dados
3. **Alerte para Ações Críticas** — Configure a monitorização de operações sensíveis
4. **Arquive Registos Antigos** — Exporte os registos com mais de 1 ano para arquivo
5. **Limite o Acesso** — Apenas os administradores devem aceder aos registos de auditoria
6. **Documente as Políticas** — Registe o seu processo de revisão de auditoria

## Desempenho

O registo de auditoria tem um impacto mínimo no desempenho:
- Os eventos são escritos de forma assíncrona
- Indexados por data/hora e utilizador para consultas rápidas
- Não bloqueia as operações dos utilizadores

As consultas extensas ao registo de auditoria (> 100 mil eventos) podem ser lentas. Utilize filtros de intervalo de datas.

## Resolução de Problemas

### Eventos de Auditoria em Falta

Se esperar um evento mas não o vir:

- Verifique o filtro de intervalo de datas
- Verifique a ortografia do e-mail do utilizador
- Confirme o nome do tipo de entidade
- Verifique se o evento ocorreu realmente (atualize a página)

### Desempenho Lento do Registo de Auditoria

Para tabelas de auditoria muito grandes (milhões de eventos):

1. Arquive os eventos antigos:
   ```bash
   curl -X GET "http://localhost:3000/api/audit?startDate=2026-01-01&endDate=2026-06-30&limit=100000" \
     -H "Authorization: Bearer $TOKEN" > archive.json
   ```

2. Peça ao DBA para analisar as estatísticas da tabela

## Integração

Exporte os eventos de auditoria para sistemas externos:

```bash
# Fetch audit events as JSON
curl -X GET "http://localhost:3000/api/audit?limit=1000" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.data[] | {timestamp, userEmail, action, entityType, entityName}' | \
  # Pipe to your logging system (ELK, Splunk, etc.)
```

## O Que Se Segue?

- **[Gestão de Utilizadores](user-management.md)** — Gerir contas de utilizador
- **[Políticas de Segurança](security.md)** — Definir controlo de acesso
- **[Monitorização](../../deployment/monitoring.md)** — Saúde e desempenho do sistema

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API - Auditoria](../../api/endpoints.md#audit-logs)
