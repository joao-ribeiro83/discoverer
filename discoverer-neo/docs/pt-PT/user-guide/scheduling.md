# Agendar Mapas

Saiba como executar mapas automaticamente segundo um agendamento e receber os resultados.

## O Que É o Agendamento?

O **Agendamento** executa um mapa automaticamente em horários especificados, armazena os resultados e, opcionalmente, envia notificações.

## Criar um Agendamento

### Passo 1: Abrir o Mapa

1. Abra o mapa que pretende agendar
2. Clique em **Agendar** ou **+ Novo Agendamento**

### Passo 2: Configurar o Agendamento

Introduza:

- **Nome do Agendamento** — Nome descritivo (p. ex., "Relatório Diário de Vendas")
- **Descrição** — Notas opcionais
- **Expressão Cron** — Quando executar (consulte os exemplos abaixo)
- **Parâmetros** — Valores fixos (se o mapa tiver parâmetros)
- **Estado** — Alternador Ativo/Inativo
- **E-mail de Notificação** — (Opcional) E-mail quando concluído

### Expressões Cron

As expressões cron definem o agendamento utilizando o formato Unix padrão:

```
0 9 * * MON-FRI   →   Todos os dias úteis às 9:00
0 0 * * *         →   Todos os dias à meia-noite
0 */6 * * *       →   A cada 6 horas
0 0 1 * *         →   Primeiro dia do mês à meia-noite
```

**Formato:** `[minuto] [hora] [dia-do-mês] [mês] [dia-da-semana]`

| Campo | Valores | Exemplo |
|-------|--------|---------|
| Minuto | 0–59 | 0, 15, 30, 45 |
| Hora | 0–23 | 0 (meia-noite), 9 (9h), 18 (18h) |
| Dia do Mês | 1–31 | 1 (dia 1), 15 (dia 15) |
| Mês | 1–12 ou JAN-DEC | 1 (jan), 6 (jun) |
| Dia da Semana | 0–6 ou SUN-SAT | 0 (dom), 5 (sex) |

**Expressões Comuns:**

| Agendamento | Expressão |
|----------|-----------|
| Todos os dias às 9h | `0 9 * * *` |
| Dias úteis às 8h | `0 8 * * MON-FRI` |
| Todas as segundas-feiras às 9h | `0 9 * * MON` |
| A cada 4 horas | `0 */4 * * *` |
| Primeiro dia do mês | `0 0 1 * *` |
| A cada 30 minutos | `*/30 * * * *` |

### Passo 3: Definir Parâmetros

Se o seu mapa tiver parâmetros, introduza valores fixos:

- **Parâmetros Fixos** — O mesmo valor em cada execução
- (Os parâmetros opcionais sem valores utilizam as predefinições)

**Exemplo:** Relatório diário de vendas para a região das Américas:
- Parâmetro `region` = "AMERICAS"

### Passo 4: Guardar o Agendamento

Clique em **Guardar Agendamento**. O agendamento fica **Ativo** de imediato (se estiver ativado).

## Gerir Agendamentos

### Ver Agendamentos

1. Clique em **Agendamentos** na barra lateral
2. Veja a lista de todos os seus agendamentos com:
   - Nome do agendamento e mapa
   - Hora da próxima execução
   - Estado da última execução
   - Alternador Ativo/Inativo

### Editar Agendamento

1. Clique no agendamento
2. Modifique a expressão cron, os parâmetros ou o e-mail
3. Clique em **Guardar**

As alterações produzem efeito de imediato.

### Desativar/Ativar

Alterne o interruptor **Ativo**:
- **Desligado** — O agendamento não será executado
- **Ligado** — O agendamento é executado no próximo intervalo

### Eliminar Agendamento

1. Clique no agendamento → **Eliminar**
2. Confirme a eliminação

O agendamento é removido; os resultados anteriores continuam disponíveis.

## Visualizar Resultados

### A Partir da Página de Agendamentos

1. Clique num agendamento
2. Veja o **Histórico de Execução** que mostra:
   - Data/hora da execução agendada
   - Hora real da execução (pode diferir ligeiramente do cron)
   - Estado (SUCCESS, FAILED, TIMEOUT)
   - Número de linhas devolvidas
   - Duração da execução

### Transferir Resultados

Clique numa execução anterior para:
- Visualizar os resultados (a mesma vista de tabela da execução manual)
- Exportar para Excel ou CSV

## Notificações

Se tiver configurado um **E-mail de Notificação**, irá receber:

**Em Caso de Sucesso:**
```
Subject: [Discoverer Neo] Schedule Complete: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" completed successfully.
- Rows: 1,524
- Duration: 12 seconds
- View: [link to results]
```

**Em Caso de Falha:**
```
Subject: [Discoverer Neo] Schedule Failed: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" failed.
- Error: Connection timeout
- Time: 2026-07-19 09:15:32 UTC
```

## Considerações Sobre Fuso Horário

As expressões cron são avaliadas no **fuso horário do servidor** (UTC por predefinição). Se o seu servidor estiver num fuso horário diferente, ajuste as expressões em conformidade.

**Exemplo:** Para executar às 9h EST (UTC-5):
- Utilize `0 14 * * *` (14h UTC = 9h EST no inverno, 10h EDT no verão)

## Exportação Agendada

Os agendamentos criam ficheiros de resultados, não anexos de e-mail. Para automatizar a exportação para Excel:

1. Crie um agendamento que capture os resultados
2. Defina o e-mail de notificação para alertar quando concluído
3. Aceda ao agendamento para transferir os resultados em XLSX/CSV

## Limites e Considerações

- **Execuções Simultâneas** — Apenas uma execução por agendamento de cada vez
- **Consultas de Longa Duração** — Se um mapa exceder o tempo limite, a execução falha
- **Agendamentos com Falha** — As execuções com falha não são repetidas automaticamente
- **Utilização de Recursos** — Muitos agendamentos simultâneos podem afetar o desempenho do sistema

## Resolução de Problemas

### O Agendamento Não Foi Executado

- Verifique se o alternador Ativo está **Ligado**
- Verifique a expressão cron (utilize um validador de cron online)
- Consulte os registos do servidor para ver erros

### Hora de Execução Incorreta

- Verifique o fuso horário do servidor
- Confirme a expressão cron (os minutos/horas podem estar invertidos)

### Erro de Memória Insuficiente

- O mapa é demasiado extenso para agendamento
- Adicione mais filtros ou parâmetros para reduzir as linhas
- Contacte o administrador

## O Que Se Segue?

- **[Partilhar Mapas](sharing.md)** — Partilhe relatórios agendados com colegas
- **[Exportar Dados](exporting-data.md)** — Transfira resultados agendados
- **[Criar Mapas](building-maps.md)** — Otimize os mapas para agendamento

---

**Consulte Também:** [Guia do Utilizador](../user-guide/), [Referência da API - Agendamentos](../../api/endpoints.md#schedules)
