# Por qué se rechazó un cálculo

Una hoja de trabajo puede ejecutarse mientras que uno de sus cálculos no. Esta
página trata de ese segundo tipo de rechazo: una única fórmula que vino de
Discoverer y no pudo compilarse.

Para una hoja de trabajo completa que no se ejecutó, consulte
[Por qué se rechazó una hoja](refusals.md).

Un cálculo de Discoverer no se almacenó como texto. Se almacenó como un árbol
de tokens numerados, y Neo convierte ese árbol en SQL. Cuando el árbol dice algo
que Neo no puede leer con seguridad, el cálculo se **rechaza con un motivo** en
lugar de compilarse a un equivalente cercano.

Esa regla merece ser expresada claramente, porque es la razón por la que
existe esta lista:

> Un cálculo rechazado es una brecha visible. Uno compilado incorrectamente es
> un número erróneo en un informe en el que la gente ha confiado durante quince
> años.

Las propias herramientas de migración de Discoverer tomaron la misma posición.
`NOT IN` nunca se compiló como `IN`, porque eso invierte el filtro y produce
un número que parece perfectamente razonable y es erróneo.

---

## Los motivos

Cada rechazo lleva uno de estos. Se enumeran por probabilidad decreciente.

### `UNFITTED_CODE`

**Qué significa.** La fórmula usa una función incorporada de Discoverer cuya
forma exacta no pudo establecerse a partir de la evidencia.

Neo no adivinó cómo se renderizan estas. Cada función incorporada que compila
se ajustó contra 37 971 pares de fórmulas reales tomados de sus propios libros
de trabajo — el árbol de tokens almacenado junto a la cadena que el propio
Discoverer colocó en pantalla. Una función que nunca apareció en un par que Neo
pudiera leer se rechaza en lugar de asumirse.

**Qué funciones.** `CASE`, `WHEN`, `ELSE`, `IS NULL`, `IS NOT NULL`, `UPPER`,
`GREATEST` y la familia analítica (`FIRST_VALUE`, `OVER`, `PARTITION`, `ORDER`,
`ROW_NUMBER`, `NPASSORDERCOMP`).

**Qué hacer.** Reescriba el cálculo en el editor de fórmulas de Neo. Un `CASE`
normalmente puede escribirse con `DECODE`, que se compila.

### `UNRESOLVED_FUNCTION`

**Qué significa.** La fórmula llama a una función PL/SQL registrada, y no existe
una función coincidente en Neo.

**Qué hacer.** Regístrela bajo **Admin → Funciones personalizadas**, haciendo
coincidir el nombre que utilizó Discoverer. Consulte
[Funciones personalizadas](../admin-guide/custom-functions.md).

### `UNRESOLVED_ELEMENT`

**Qué significa.** La fórmula se refiere a una columna o un parámetro que el
libro de trabajo ya no contiene. La referencia sobrevivió; la cosa a la que
señalaba no.

**Qué hacer.** Abra el cálculo y reoriente lo hacia una columna activa. Esto
suele ser un libro de trabajo de Discoverer que se editó después de que se
eliminara la columna.

### `INVALID_IDENTIFIER`

**Qué significa.** Un nombre de columna, nombre de parámetro o nombre de
función que llegó a la fórmula no es un identificador Oracle válido.

Neo rechaza estos en lugar de entrecomillarlos para mayor seguridad. Un nombre
que lleva una comilla, un punto y coma o un corchete es un defecto de metadatos
o un intento de inyección SQL, y entrecomillarlo ocultaría ambos.

**Qué hacer.** Corrija el nombre en **Admin → Metadatos**. Un nombre de función
calificado por paquete (`PKG.CALC`) también acaba aquí: registre un contenedor
con un solo nombre.

### `BAD_ARITY`

**Qué significa.** El número de argumentos no coincide con nada de lo que Neo
tiene evidencia — para una función incorporada, cualquier forma vista en su
patrimonio; para una función registrada, los **Parámetros** que definió para
ella.

**Qué hacer.** Para una función registrada, verifique que su lista de parámetros
sea correcta. Para una función incorporada, la fórmula probablemente esté
dañada y debería reescribirse.

### `UNREAGGREGABLE`

**Qué significa.** El cálculo contiene una agregación que no puede
re-totalizarse correctamente a través de una combinación — `AVG`, `COUNT
DISTINCT`, `STDDEV` o `VARIANCE`.

Neo reescribe algunas consultas para evitar contar dos veces. Estos cuatro no
pueden sobrevivir esa reescritura: un promedio de promedios no es el promedio.

**Qué hacer.** Traslade la agregación a la hoja de trabajo, o restrinja la hoja
de trabajo a una carpeta para que no se necesite reescritura. El mismo motivo
en una hoja de trabajo completa se cubre en [refusals.md](refusals.md).

### `DATE_WITH_TIME`

**Qué significa.** Una fecha almacenada lleva una hora, y Neo no la descartará
silenciosamente.

Las fechas en Discoverer se almacenan con seis dígitos posteriores para la hora.
Cada una de las 7 670 fechas en este patrimonio los tiene establecidos a cero,
así que Neo compila la fecha y sabe que no ha perdido nada. Una fecha que
realmente llevara una hora sería un valor diferente, y truncarla cambiaría un
resultado silenciosamente.

**Qué hacer.** Infórmelo. Esto no se ha observado en la práctica y Neo querría
ver el libro de trabajo.

### `UNKNOWN_SEMANTICS`

**Qué significa.** El cálculo usa una característica de Discoverer cuyo
resultado no es visible en lo que Discoverer mostró, así que no hay nada de lo
que derivar el SQL.

En la práctica esto es una cosa: `2_Pass_Percentage`. Discoverer lo mostró como
su argumento solo, así que nada en la evidencia dice qué realmente computó.

**Qué hacer.** Reescriba lo como un cálculo de porcentaje explícito.

### `UNKNOWN_NODE`, `UNKNOWN_LITERAL_KIND`, `PARSE_FAILED`

**Qué significa.** La fórmula almacenada no es algo que Neo pueda leer en
absoluto.

**Qué hacer.** Infórmelo con el nombre del libro de trabajo. Estos indican o
una característica de Discoverer que nadie ha encontrado aún o un libro de
trabajo dañado, y Neo no puede diferenciar sin verlo.

### `NOT_IN_ALLOWLIST`

**Qué significa.** La fórmula generaría una función SQL que no está en la lista
de funciones que Neo emitirá.

**Qué hacer.** Infórmelo. Solo un conjunto pequeño y fijo de funciones Oracle
puede generarse, y llegar a este motivo significa que una función incorporada
se asignó a algo fuera de él — que es un defecto en Neo, no en sus metadatos.

### `CALCULATION_CYCLE`

**Qué significa.** El cálculo se refiere a otro cálculo que se refiere nuevamente
a él, directa o a través de una cadena. No hay valor que computar.

Discoverer permite que un cálculo use otro por nombre, y Neo sustituye la cadena
completa en lugar del nombre. Un bucle no tiene fondo, por lo que se rechaza con
la cadena nombrada en lugar de expandida hasta que algo falla.

**Qué hacer.** Abra el cálculo en el editor de fórmulas de Neo e interrumpa el
bucle. El rechazo nombra cada cálculo en el anillo.

### `EXPANSION_TOO_DEEP`, `EXPANSION_TOO_LARGE`

**Qué significa.** La cadena de cálculos que se refieren a cálculos es más
larga que 16 enlaces, o se expande a más de 20 000 nodos.

El segundo es el que realmente sucede: una cadena que no es una cadena sino un
diamante, donde varios cálculos comparten un padre, multiplica en lugar de
sumar.

**Qué hacer.** Aplane la cadena. Un cálculo usado por varios otros puede
normalmente escribirse una vez como un elemento de carpeta en su lugar, que se
computa una vez en lugar de sustituirse en todas partes.

### `NO_SOURCE_TOKENS`

**Qué significa.** Neo tiene el texto legible de la fórmula pero no el árbol de
tokens del que vino, así que no hay nada que compilar.

Esto **no** es una brecha en lo que Neo entiende. Sucede cuando el patrimonio se
migró con una versión de la herramienta que no mantuvo la forma de tokens, y
afecta a cada cálculo en tal patrimonio por igual.

**Qué hacer.** Re-importe los mapas. Eso escribe la forma de tokens junto a cada
fórmula y los cálculos se compilan normalmente. Nada más lo cambia.

### `TOKENS_NOT_RETAINED`

**Qué significa.** La misma situación que `NO_SOURCE_TOKENS`, informada por la
verificación anterior basada en texto: la fórmula almacenada todavía visiblemente
contiene tokens estilo `[1,102]` y el árbol detrás de ellos no se mantuvo.

**Qué hacer.** Re-importe los mapas.

---

## Qué no significa un rechazo

- **No es un error de datos.** Nada sobre sus datos es incorrecto.
- **No oculta el original.** La forma de token de Discoverer almacenada se
  mantiene junto a la compilada, así que un cálculo rechazado hoy se compila el
  día en que la brecha se cierre, sin re-ejecutar la migración.
- **No detiene la hoja de trabajo.** Otras columnas aún se ejecutan.

---

**Ver también:** [Por qué se rechazó una hoja](refusals.md),
[Funciones personalizadas](../admin-guide/custom-functions.md)
