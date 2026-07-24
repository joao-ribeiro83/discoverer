# Exportación de datos

Aprenda a descargar los resultados de un mapa como archivos Excel o CSV.

## Formatos de exportación

| Formato | Idóneo para | Características |
|--------|----------|----------|
| **XLSX** (Excel) | Informes profesionales, análisis | Formato, varias hojas, gráficos |
| **CSV** (valores separados por comas) | Integración de datos, hojas de cálculo | Texto sin formato, compatibilidad universal |

## Exportación de los resultados

### Desde la ejecución de un mapa

1. Tras ejecutar un mapa, haga clic en el botón **Exportar**
2. Elija el formato: **XLSX** o **CSV**
3. Haga clic en **Exportar**

El trabajo de exportación se pone en cola y comenzará a procesarse.

### Estado de la descarga

Verá un panel de estado que muestra:
- **Estado** — PENDING, PROCESSING, COMPLETED, FAILED
- **Tamaño del archivo** — Una vez completado
- **Caduca** — Cuándo se eliminará el archivo (valor predeterminado: 7 días)

Haga clic en **Descargar** cuando el estado sea **COMPLETED**.

### Opciones de exportación

Al exportar, puede elegir:
- **Todas las filas** — Exporta todas las filas coincidentes (los mismos filtros que el mapa)
- **Página actual** — Exporta solo las filas visibles
- **Incluir formato** — (Solo XLSX) Aplica el formato de presentación y los colores

## Almacenamiento de archivos

Los archivos exportados se almacenan temporalmente:
- **Período de retención** — 7 días (configurable por el administrador)
- **Ubicación** — Directorio de exportación del servidor
- **Tras la caducidad** — Los archivos se eliminan automáticamente

## Exportaciones de gran tamaño

Para conjuntos de resultados muy grandes:

1. Las exportaciones se ejecutan de forma asíncrona en segundo plano
2. Puede salir y volver más tarde
3. Consulte la sección **Exportaciones** para ver todas las exportaciones pendientes/completadas

**Sugerencias para exportaciones de gran tamaño:**
- Las exportaciones mantienen una conexión de base de datos durante toda su duración
- Es posible que varias exportaciones simultáneas se limiten para preservar el rendimiento
- Las exportaciones muy grandes (millones de filas) pueden fallar o agotar el tiempo de espera
- Póngase en contacto con el administrador para aumentar los límites de exportación si es necesario

## Solución de problemas de descarga

### Administrador de descargas del navegador

Los archivos descargados aparecen en la ubicación de descargas predeterminada de su navegador:
- **Chrome/Firefox:** consulte la carpeta Descargas
- **Safari:** consulte la carpeta Descargas o la notificación
- **IE/Edge:** puede abrir un cuadro de diálogo para guardar

### Error de exportación

Si el estado muestra **FAILED**:
- Compruebe el mensaje de error (si se muestra)
- Pruebe a exportar menos filas (aplique más filtros)
- Póngase en contacto con el administrador si el problema persiste

### Corrupción de archivos

Si el archivo descargado está dañado:
- Pruebe a exportarlo de nuevo
- Utilice un formato diferente (XLSX ↔ CSV)
- Compruebe el espacio en disco de su ordenador

## Visualización de los archivos exportados

### XLSX (Excel)

Ábralo con:
- Microsoft Excel
- Google Sheets
- LibreOffice Calc
- Cualquier aplicación de hoja de cálculo

**Características de XLSX:**
- Encabezados de columna a partir de los nombres para mostrar del mapa
- Tipos de datos conservados (números, fechas)
- Formato aplicado (si se selecciona «Incluir formato»)
- Admite un gran número de filas (hasta ~1 millón por hoja)

### CSV

Ábralo con:
- Aplicaciones de hoja de cálculo (Excel, Sheets, Calc)
- Editores de texto (Notepad, VS Code)
- Herramientas de datos (Python, R, SQL)

**Formato CSV:**
- Delimitado por comas de forma predeterminada
- Codificación UTF-8
- Los valores entre comillas contienen caracteres especiales
- Adecuado para importar a bases de datos o scripts

## Compartir los archivos exportados

Una vez descargados, los archivos exportados dejan de estar vinculados a Discoverer Neo:
- Envíelos por correo electrónico a sus colegas
- Cárguelos en almacenamiento en la nube
- Impórtelos a otros sistemas
- Compártalos a través del sistema de archivos de su organización

## Sugerencias de rendimiento

1. **Filtre primero** — Aplique condiciones en el mapa para reducir el número de filas
2. **Limite el intervalo de fechas** — Utilice parámetros de fecha para acotar los resultados
3. **Excluya texto extenso** — Quite las columnas de texto anchas si no las necesita
4. **Programe para horas de menor actividad** — Las exportaciones grandes se ejecutan más rápido en períodos de baja actividad

## ¿Qué sigue?

- **[Programación de mapas](scheduling.md)** — Automatice la generación de exportaciones
- **[Uso compartido de mapas](sharing.md)** — Comparta consultas con sus colegas
- **[Creación de mapas](building-maps.md)** — Optimice su mapa para la exportación

---

**Consulte también:** [Ejecución de mapas](executing-maps.md), [Guía del usuario](../user-guide/)
