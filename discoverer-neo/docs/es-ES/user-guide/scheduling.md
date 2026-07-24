# Programación de mapas

Aprenda a ejecutar mapas automáticamente según una programación y a recibir los resultados.

## ¿Qué es la programación?

La **programación** ejecuta un mapa automáticamente a las horas especificadas, almacena los resultados y, opcionalmente, envía notificaciones.

## Creación de una programación

### Paso 1: abrir el mapa

1. Abra el mapa que desea programar
2. Haga clic en **Programar** o **+ Nueva programación**

### Paso 2: configurar la programación

Introduzca:

- **Nombre de la programación** — Nombre descriptivo (p. ej., «Informe de ventas diario»)
- **Descripción** — Notas opcionales
- **Expresión cron** — Cuándo ejecutarla (consulte los ejemplos a continuación)
- **Parámetros** — Valores fijos (si el mapa tiene parámetros)
- **Estado** — Conmutador Activa/Inactiva
- **Correo electrónico de notificación** — (Opcional) Correo electrónico al finalizar

### Expresiones cron

Las expresiones cron definen la programación mediante el formato Unix estándar:

```
0 9 * * MON-FRI   →   Todos los días laborables a las 9:00
0 0 * * *         →   Todos los días a medianoche
0 */6 * * *       →   Cada 6 horas
0 0 1 * *         →   El primer día del mes a medianoche
```

**Formato:** `[minuto] [hora] [día-del-mes] [mes] [día-de-la-semana]`

| Campo | Valores | Ejemplo |
|-------|--------|---------|
| Minuto | 0–59 | 0, 15, 30, 45 |
| Hora | 0–23 | 0 (medianoche), 9 (9:00), 18 (18:00) |
| Día del mes | 1–31 | 1 (día 1), 15 (día 15) |
| Mes | 1–12 o JAN-DEC | 1 (ene), 6 (jun) |
| Día de la semana | 0–6 o SUN-SAT | 0 (dom), 5 (vie) |

**Expresiones habituales:**

| Programación | Expresión |
|----------|-----------|
| Todos los días a las 9:00 | `0 9 * * *` |
| Días laborables a las 8:00 | `0 8 * * MON-FRI` |
| Todos los lunes a las 9:00 | `0 9 * * MON` |
| Cada 4 horas | `0 */4 * * *` |
| El primer día del mes | `0 0 1 * *` |
| Cada 30 minutos | `*/30 * * * *` |

### Paso 3: establecer los parámetros

Si su mapa tiene parámetros, introduzca valores fijos:

- **Parámetros fijos** — El mismo valor en cada ejecución
- (Los parámetros opcionales sin valores utilizan los valores predeterminados)

**Ejemplo:** informe de ventas diario para la región de las Américas:
- Parámetro `region` = «AMERICAS»

### Paso 4: guardar la programación

Haga clic en **Guardar programación**. La programación pasa a estar **Activa** de inmediato (si está habilitada).

## Gestión de las programaciones

### Ver las programaciones

1. Haga clic en **Programaciones** en la barra lateral
2. Verá una lista de todas sus programaciones con:
   - El nombre de la programación y el mapa
   - La hora de la próxima ejecución
   - El estado de la última ejecución
   - El conmutador Activa/Inactiva

### Editar una programación

1. Haga clic en la programación
2. Modifique la expresión cron, los parámetros o el correo electrónico
3. Haga clic en **Guardar**

Los cambios surten efecto de inmediato.

### Deshabilitar/Habilitar

Utilice el conmutador **Activa**:
- **Desactivado** — La programación no se ejecutará
- **Activado** — La programación se ejecuta en el próximo intervalo

### Eliminar una programación

1. Haga clic en la programación → **Eliminar**
2. Confirme la eliminación

La programación se elimina; los resultados anteriores permanecen disponibles.

## Consulta de los resultados

### Desde la página de programaciones

1. Haga clic en una programación
2. Consulte el **historial de ejecución**, que muestra:
   - La fecha y hora de la ejecución programada
   - La hora real de ejecución (puede diferir ligeramente de cron)
   - El estado (SUCCESS, FAILED, TIMEOUT)
   - El número de filas devueltas
   - La duración de la ejecución

### Descargar los resultados

Haga clic en una ejecución anterior para:
- Ver los resultados (la misma vista de tabla que en la ejecución manual)
- Exportar a Excel o CSV

## Notificaciones

Si ha configurado un **correo electrónico de notificación**, recibirá:

**En caso de éxito:**
```
Subject: [Discoverer Neo] Schedule Complete: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" completed successfully.
- Rows: 1,524
- Duration: 12 seconds
- View: [link to results]
```

**En caso de error:**
```
Subject: [Discoverer Neo] Schedule Failed: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" failed.
- Error: Connection timeout
- Time: 2026-07-19 09:15:32 UTC
```

## Consideraciones sobre la zona horaria

Las expresiones cron se evalúan en la **zona horaria del servidor** (UTC de forma predeterminada). Si su servidor se encuentra en una zona horaria diferente, ajuste las expresiones en consecuencia.

**Ejemplo:** para ejecutar a las 9:00 EST (UTC-5):
- Utilice `0 14 * * *` (14:00 UTC = 9:00 EST en invierno, 10:00 EDT en verano)

## Exportación programada

Las programaciones crean archivos de resultados, no archivos adjuntos de correo electrónico. Para automatizar la exportación a Excel:

1. Cree una programación que capture los resultados
2. Configure el correo electrónico de notificación para que avise cuando finalice
3. Acceda a la programación para descargar los resultados como XLSX/CSV

## Límites y consideraciones

- **Ejecuciones simultáneas** — Solo una ejecución por programación a la vez
- **Consultas de larga duración** — Si un mapa supera el tiempo de espera, la ejecución falla
- **Programaciones fallidas** — Las ejecuciones fallidas no se reintentan automáticamente
- **Uso de recursos** — Muchas programaciones simultáneas pueden afectar al rendimiento del sistema

## Resolución de problemas

### La programación no se ha ejecutado

- Compruebe si el conmutador Activa está **Activado**
- Verifique la expresión cron (utilice un validador de cron en línea)
- Consulte los registros del servidor en busca de errores

### Hora de ejecución incorrecta

- Verifique la zona horaria del servidor
- Confirme la expresión cron (los minutos y las horas podrían estar invertidos)

### Error de memoria insuficiente

- El mapa es demasiado grande para su programación
- Añada más filtros o parámetros para reducir el número de filas
- Póngase en contacto con el administrador

## ¿Qué sigue?

- **[Uso compartido de mapas](sharing.md)** — Comparta informes programados con sus colegas
- **[Exportación de datos](exporting-data.md)** — Descargue los resultados programados
- **[Creación de mapas](building-maps.md)** — Optimice los mapas para su programación

---

**Consulte también:** [Guía del usuario](../user-guide/), [Referencia de la API - Programaciones](../../api/endpoints.md#schedules)
