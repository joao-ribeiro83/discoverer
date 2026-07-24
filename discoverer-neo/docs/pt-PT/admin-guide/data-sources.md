# Gerir Origens de Dados

Saiba como adicionar e gerir ligações a origens de dados Oracle e PostgreSQL.

## O Que É uma Origem de Dados?

Uma **Origem de Dados** é uma ligação nomeada a uma base de dados Oracle ou PostgreSQL. As pastas nas áreas de negócio referenciam origens de dados para saberem onde ir buscar os dados.

## Criar uma Origem de Dados

### Adicionar Ligação Oracle

1. Painel de Administração → **Origens de Dados**
2. Clique em **+ Nova Origem de Dados**
3. Selecione **Oracle** como tipo de ligação
4. Introduza:
   - **Nome** — Identificador único (p. ex., "ERP de Produção")
   - **Descrição** — Notas (opcional)
   - **Anfitrião** — Nome de anfitrião ou IP do servidor
   - **Porta** — Porta do listener (predefinição: 1521)
   - **Service Name** ou **SID** — Identificador da base de dados
   - **Nome de Utilizador** — Utilizador da base de dados (p. ex., EUL5_US)
   - **Palavra-passe** — Palavra-passe da base de dados
5. Clique em **Testar Ligação** para verificar
6. Clique em **Criar**

### Adicionar Ligação PostgreSQL

1. Painel de Administração → **Origens de Dados**
2. Clique em **+ Nova Origem de Dados**
3. Selecione **PostgreSQL** como tipo de ligação
4. Introduza:
   - **Nome** — Identificador único
   - **Descrição** — Notas (opcional)
   - **Anfitrião** — Nome de anfitrião ou IP do servidor
   - **Porta** — Predefinição: 5432
   - **Base de Dados** — Nome da base de dados
   - **Nome de Utilizador** — Utilizador da base de dados
   - **Palavra-passe** — Palavra-passe da base de dados
5. Clique em **Testar Ligação**
6. Clique em **Criar**

## Detalhes da Ligação Oracle

### Modo Thin (Predefinição)

O modo thin liga sem o Oracle Instant Client:

- **Vantagens:** Sem instalação de cliente, mais leve, Node.js puro
- **Desvantagens:** Não é possível ligar a bases de dados anteriores à 12.1
- **Ideal para:** Oracle 12.1+ moderno

**Não é necessária configuração.** O modo thin é a predefinição.

### Modo Thick (Legado)

O modo thick requer o Oracle Instant Client para bases de dados legadas:

- **Vantagens:** Suporta Oracle 11.2+, permite nomenclatura LDAP, encriptação de rede
- **Desvantagens:** Requer a instalação do Instant Client, maior consumo de recursos
- **Ideal para:** Bases de dados Oracle 11.2–12.0 mais antigas, requer sqlnet.ora

**Para ativar o modo thick:**

1. Crie a imagem Docker com o cliente:
   ```bash
   docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
   ```

2. Defina a variável de ambiente:
   ```bash
   ORACLE_THICK_MODE=true
   ORACLE_CLIENT_PATH=/opt/oracle/instantclient
   ```

3. O backend verifica se o cliente está instalado e não inicia se não o encontrar

## Pooling de Ligações

O Discoverer Neo mantém um pool de ligações por origem de dados:

**Configuração do Pool** (variáveis de ambiente):
- `ORACLE_POOL_MIN` — Ligações inativas mínimas (predefinição: 2)
- `ORACLE_POOL_MAX` — Ligações máximas (predefinição: 10)
- `ORACLE_POOL_INCREMENT` — Novas ligações por alocação (predefinição: 1)
- `ORACLE_POOL_IDLE_TIMEOUT_SECONDS` — Tempo limite de inatividade (predefinição: 300)

**Orientação Para o Dimensionamento do Pool:**

Com 4 origens de dados Oracle, cada uma com `ORACLE_POOL_MAX=10`:
- É possível um máximo de 40 ligações simultâneas
- Tem de caber dentro dos limites de `sessions`/`processes` da base de dados

Dimensione com base nas **execuções de mapas simultâneas** esperadas, não nos utilizadores:
- Cada execução de mapa mantém 1 ligação durante a consulta
- As exportações mantêm 1 ligação durante toda a exportação (minutos)
- Implementação típica: 2–10 no máximo por origem

### Ajustar o Tamanho do Pool

Para aumentar o limite de ligações (se a base de dados o permitir):

1. Edite o `.env`:
   ```bash
   ORACLE_POOL_MAX=20
   ```

2. Aumente os limites da base de dados:
   ```sql
   ALTER SYSTEM SET processes=300;  # Default often 150
   ```

3. Reinicie o backend:
   ```bash
   docker compose restart backend
   ```

## Testar a Ligação

Depois de criar uma origem de dados, teste a conetividade:

1. Clique na origem de dados → **Testar Ligação**
2. Estado apresentado:
   - ✓ **Ligado** — Ligação bem-sucedida
   - ✗ **Falhou** — Mensagem de erro apresentada

**Erros comuns:**

- **Anfitrião inacessível** — Verifique a rede, a firewall e o nome de anfitrião
- **Credenciais inválidas** — Verifique o nome de utilizador/palavra-passe
- **Base de dados não encontrada** — Verifique a ortografia do service name/SID
- **Listener não em execução** — Reinicie o listener Oracle

## Editar Origem de Dados

1. Clique na origem de dados → **Editar**
2. Modifique qualquer campo (a palavra-passe pode ficar em branco para manter a existente)
3. Clique em **Guardar**

**Nota:** Alterar os detalhes da ligação pode quebrar pastas existentes se estas deixarem de conseguir aceder aos dados. Teste com cuidado.

## Desativar Origem de Dados

Alterne **Ativo** para desativar temporariamente:

- **Desligado** — As pastas não conseguem obter dados desta origem
- **Ligado** — As pastas conseguem obter dados normalmente

Útil para manutenção sem eliminar a origem.

## Eliminar Origem de Dados

1. Clique na origem de dados → **Eliminar**
2. Confirme

Quaisquer pastas que utilizem esta origem deixam de poder ser executadas. Os mapas ficam quebrados.

## Encriptação da Ligação

As palavras-passe são encriptadas em repouso utilizando AES-256-GCM:

- **Chave:** Variável de ambiente `ENCRYPTION_KEY` (mínimo de 32 carateres)
- **Armazenamento:** Encriptadas na base de dados PostgreSQL
- **Transmissão:** Utilize sempre HTTPS em produção

Alterar a chave de encriptação:

1. Defina uma nova `ENCRYPTION_KEY` no ambiente
2. Reinicie o backend
3. O backend volta a encriptar automaticamente todas as palavras-passe armazenadas

**Importante:** Se perder a chave de encriptação, as palavras-passe armazenadas tornam-se irrecuperáveis. Faça uma cópia de segurança das chaves de encriptação em local seguro.

## Monitorizar a Saúde das Ligações

Verifique o estado do pool de ligações na monitorização:

- **Métricas:** Endpoint `/metrics`
- **Indicador (gauge):** `oracledb_pool_connections_active`, `oracledb_pool_connections_idle`
- **Utilização:** Monitorização com Prometheus (consulte [Guia de Monitorização](../../deployment/monitoring.md))

## Importação em Lote (Migração)

Ao migrar do Oracle Discoverer:

1. Utilize a CLI `dn-migrate` para importar os metadados do EUL
2. Crie origens de dados para todas as origens referenciadas
3. Importe áreas de negócio, pastas e itens utilizando a ferramenta de migração

Consulte o [Guia de Migração](../../migration/).

## Conetividade de Rede

### Regras de Firewall

Garanta a conetividade de rede:
- Backend → Oracle: Porta 1521 (Oracle predefinida)
- Backend → PostgreSQL: Porta 5432 (PostgreSQL predefinida)

### Resolução de DNS

Se utilizar nomes de anfitrião, verifique o DNS:
```bash
# Test from backend container
docker compose exec backend nslookup oracle.example.com
```

### Túnel SSH

Para ligações seguras através de SSH:

1. Estabeleça um túnel do backend para o anfitrião da base de dados:
   ```bash
   ssh -L 1521:oracle-internal:1521 bastion-host
   ```

2. Utilize `localhost:1521` na cadeia de ligação

3. Mantenha o túnel em execução (pode precisar de uma política de reinício)

## Cópia de Segurança e Restauro

As origens de dados são armazenadas no PostgreSQL. Consulte o [Guia de Cópia de Segurança](../../deployment/backup.md).

Para restaurar:
1. Restaure a base de dados PostgreSQL
2. As origens de dados são recuperadas automaticamente
3. Os testes de ligação funcionam se houver rede disponível para as origens

## Resolução de Problemas

### Pool de Ligações Esgotado

**Erro:** "Connection timeout waiting for a connection"

**Causas:**
- Demasiadas consultas ou exportações simultâneas
- Tamanho do pool demasiado pequeno
- Limite de ligações da base de dados atingido

**Solução:**
1. Aumente `ORACLE_POOL_MAX` (e `sessions` da base de dados)
2. Reduza as tarefas de exportação simultâneas (`EXPORT_WORKER_CONCURRENCY`)
3. Otimize as consultas lentas

### Ligações Obsoletas

**Erro:** "Connection reset by peer"

**Causa:** A base de dados fechou ligações inativas; o pool não o detetou

**Solução:**
- Reduza `ORACLE_POOL_IDLE_TIMEOUT_SECONDS`
- Reinicie o backend (recicla o pool)

## O Que Se Segue?

- **[Introspeção Oracle](oracle-introspection.md)** — Importar tabelas automaticamente
- **[Gestão de Metadados](metadata-management.md)** — Organizar pastas e itens
- **[Políticas de Segurança](security.md)** — Definir segurança ao nível da linha

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Configuração da Implementação](../../deployment/configuration.md)
