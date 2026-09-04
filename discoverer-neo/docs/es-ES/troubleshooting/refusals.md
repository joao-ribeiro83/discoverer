# Por qué se rechazó una hoja

Un **rechazo** no es un fallo. Es el planificador de consultas diciendo que
puede construir el SQL, pero no puede garantizar que la cifra sea correcta —
así que no la ejecuta.

Discoverer rechazaba las mismas formas. Una cifra equivocada que parece
correcta es peor que ninguna cifra.

Un rechazo se muestra como un panel **ámbar** con un título, un motivo y un
paso siguiente. Un panel rojo es un error real y significa otra cosa; consulte
[Ejecución de mapas](../user-guide/executing-maps.md).

La fase 3.3 ampliará esta página conforme el planificador de consultas gane
nuevas comprobaciones.

---

## Este total todavía no es fiable, por eso no se ejecutó

**Código:** `MULTI_FOLDER_AGGREGATE`

### Qué se pidió

La hoja totaliza un valor — `SUM`, `AVG`, `COUNT`, `COUNT DISTINCT` — sobre
columnas que vienen de más de una carpeta.

### Por qué no se puede responder

Las carpetas están unidas de uno a muchos. Cada fila del lado «uno» se repite
una vez por cada fila coincidente del lado «muchos». Sumar después de esa
unión cuenta el mismo valor una vez por repetición, así que el total sale
demasiado alto.

Esto se llama **fan trap** (trampa de abanico). El propio ejemplo de Oracle
sitúa la inflación en dos o tres veces, sobre dos medidas a la vez. Nada en la
pantalla le diría que la cifra estaba mal.

### Qué cambiar

- Totalice un valor de **una sola carpeta**. Quite las columnas que acceden a
  la segunda carpeta, o elimine el total.
- O divida la hoja en dos, una por carpeta.
- O conserve las filas de detalle y totalícelas fuera del producto.

Los totales entre carpetas estarán disponibles cuando se publique el
planificador de fan-trap (fase 3.4). Su hoja no necesitará ningún cambio: la
misma hoja simplemente empezará a devolver una cifra correcta.

---

## Estas carpetas no están conectadas, por eso no se ejecutó la hoja

**Código:** `NO_JOIN_PATH`

### Qué se pidió

La hoja usa columnas de dos o más carpetas, y ninguna cadena de uniones las
enlaza.

### Por qué no se puede responder

Sin una unión, la base de datos no tiene regla para emparejar las filas.
Emparejaría cada fila de una carpeta con cada fila de la otra — una **unión
cruzada** — y devolvería un número de filas igual al producto de las dos, sin
significado.

### Qué cambiar

- Quite las columnas de la carpeta no conectada. El panel nombra las carpetas
  implicadas.
- O pida a un administrador que defina una unión entre ellas, en
  **Modelado de datos → Uniones**.

Un administrador puede comprobar si la unión existe pero no se migró: algunas
uniones de Discoverer no sobreviven a una importación de EUL si sus dos
carpetas no estaban ambas dentro del alcance.
