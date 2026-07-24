# Exportar Dados

Saiba como transferir os resultados de um mapa em ficheiros Excel ou CSV.

## Formatos de Exportação

| Formato | Ideal Para | Funcionalidades |
|--------|----------|----------|
| **XLSX** (Excel) | Relatórios profissionais, análise | Formatação, várias folhas, gráficos |
| **CSV** (valores separados por vírgulas) | Integração de dados, folhas de cálculo | Texto simples, compatibilidade universal |

## Exportar Resultados

### A Partir da Execução de um Mapa

1. Depois de executar um mapa, clique no botão **Exportar**
2. Escolha o formato: **XLSX** ou **CSV**
3. Clique em **Exportar**

A tarefa de exportação é colocada em fila e o processamento inicia-se.

### Estado da Transferência

É apresentado um painel de estado que mostra:
- **Estado** — PENDING, PROCESSING, COMPLETED, FAILED
- **Tamanho do Ficheiro** — Após a conclusão
- **Expira** — Quando o ficheiro será eliminado (predefinição: 7 dias)

Clique em **Transferir** quando o estado for **COMPLETED**.

### Opções de Exportação

Ao exportar, pode escolher:
- **Todas as Linhas** — Exportar todas as linhas correspondentes (os mesmos filtros do mapa)
- **Página Atual** — Exportar apenas as linhas visíveis
- **Incluir Formatação** — (apenas XLSX) Aplicar formatação de apresentação e cores

## Armazenamento de Ficheiros

Os ficheiros exportados são armazenados temporariamente:
- **Período de Retenção** — 7 dias (configurável pelo administrador)
- **Localização** — Diretório de exportação do servidor
- **Após a Expiração** — Os ficheiros são eliminados automaticamente

## Exportações Extensas

Para conjuntos de resultados muito extensos:

1. As exportações são executadas de forma assíncrona em segundo plano
2. Pode navegar para outro local e regressar mais tarde
3. Consulte a secção **Exportações** para ver todas as exportações pendentes/concluídas

**Sugestões para exportações extensas:**
- As exportações mantêm uma ligação à base de dados durante toda a sua duração
- Várias exportações em simultâneo podem ser limitadas para preservar o desempenho
- Exportações muito extensas (milhões de linhas) podem falhar ou exceder o tempo limite
- Contacte o administrador para aumentar os limites de exportação, se necessário

## Resolver Problemas de Transferência

### Gestor de Transferências do Navegador

Os ficheiros transferidos surgem na localização de transferências predefinida do seu navegador:
- **Chrome/Firefox:** Consulte a pasta Transferências
- **Safari:** Consulte a pasta Transferências ou a notificação
- **IE/Edge:** Pode abrir uma caixa de diálogo de gravação

### Falha na Exportação

Se o estado indicar **FAILED**:
- Verifique a mensagem de erro (se apresentada)
- Experimente exportar menos linhas (filtre mais)
- Contacte o administrador se persistir

### Ficheiro Corrompido

Se o ficheiro transferido estiver corrompido:
- Experimente exportar novamente
- Utilize um formato diferente (XLSX ↔ CSV)
- Verifique o espaço em disco do seu computador

## Visualizar Ficheiros Exportados

### XLSX (Excel)

Abrir com:
- Microsoft Excel
- Google Sheets
- LibreOffice Calc
- Qualquer aplicação de folha de cálculo

**Funcionalidades no XLSX:**
- Cabeçalhos de coluna a partir dos nomes de apresentação do mapa
- Tipos de dados preservados (números, datas)
- Formatação aplicada (se "Incluir Formatação" estiver selecionado)
- Suporte para grandes quantidades de linhas (até cerca de 1 milhão por folha)

### CSV

Abrir com:
- Aplicações de folha de cálculo (Excel, Sheets, Calc)
- Editores de texto (Notepad, VS Code)
- Ferramentas de dados (Python, R, SQL)

**Formato CSV:**
- Delimitado por vírgulas por predefinição
- Codificação UTF-8
- Os valores entre aspas contêm carateres especiais
- Adequado para importação em bases de dados ou scripts

## Partilhar Ficheiros Exportados

Depois de transferidos, os ficheiros exportados deixam de estar associados ao Discoverer Neo:
- Envie-os por e-mail a colegas
- Carregue-os para armazenamento na nuvem
- Importe-os para outros sistemas
- Partilhe-os através do sistema de ficheiros da sua organização

## Sugestões de Desempenho

1. **Filtre Primeiro** — Aplique condições no mapa para reduzir as linhas
2. **Limite o Intervalo de Datas** — Utilize parâmetros de data para restringir os resultados
3. **Exclua Texto Extenso** — Remova colunas de texto largas se não forem necessárias
4. **Agende Fora das Horas de Ponta** — As exportações extensas são mais rápidas em períodos de menor atividade

## O Que Se Segue?

- **[Agendar Mapas](scheduling.md)** — Automatize a geração de exportações
- **[Partilhar Mapas](sharing.md)** — Partilhe consultas com colegas
- **[Criar Mapas](building-maps.md)** — Otimize o seu mapa para exportação

---

**Consulte Também:** [Executar Mapas](executing-maps.md), [Guia do Utilizador](../user-guide/)
