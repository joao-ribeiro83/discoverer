# Por qué se rechazó una hoja

Un **rechazo** no es un fallo. Es el planificador de consultas diciendo que
puede construir el SQL, pero no puede garantizar que la cifra sea correcta —
así que no la ejecuta.

Discoverer rechazaba las mismas formas. Una cifra equivocada que parece
correcta es peor que ninguna cifra.

Un rechazo se muestra como un panel **ámbar** con un título, un motivo y un
paso siguiente. Un panel rojo es un error real y significa otra cosa; consulte
[Ejecución de mapas](../user-guide/executing-maps.md).

El planificador de consultas rechaza además cinco formas de trampa de abanico
(`FAN_TRAP_R1` a `FAN_TRAP_R4` y `FAN_TRAP_REAGG`). Esas cinco están descritas
por ahora solo en la [página en inglés](../../troubleshooting/refusals.md); el
panel de rechazo sí está traducido.

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
