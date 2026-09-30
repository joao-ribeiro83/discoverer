# Su rol de un vistazo

Usted es **Manager**. Ve todos los mapas de Discoverer Neo, los ejecuta, los exporta, los programa y los comparte. Se ocupa de quién puede abrir qué. También ayuda a modelar los datos, pero solo en las áreas de negocio a las que se le ha dado acceso.

Un **mapa** es un informe (en Oracle Discoverer era una hoja de trabajo). Un **libro** es un grupo de mapas. Un **área de negocio** es un grupo de datos relacionados. Una **carpeta** es una tabla o una vista dentro de un área de negocio, y un **elemento** es una columna de una carpeta.

## Puede / No puede

| Puede | No puede |
|---|---|
| Ver todos los mapas, también los privados | Cambiar un mapa que no es suyo, salvo que se haya compartido con usted como **Puede editar** |
| Ejecutar, exportar y programar todos los mapas (siguen aplicándose las reglas de datos que se indican más abajo) | Eliminar un mapa que no es suyo |
| Compartir cualquier mapa, y cambiar o quitar cualquier recurso compartido | Ver el texto SQL o el plan de base de datos de una ejecución |
| Copiar cualquier mapa para crear su propia versión | Crear, eliminar o cambiar concesiones en áreas de negocio |
| Entregar un mapa a otro propietario | Crear, editar o eliminar usuarios |
| Abrir la página Usuarios y ver qué mapas puede abrir cada persona | Crear, editar o eliminar orígenes de datos, ni importar tablas desde uno |
| Crear, editar y eliminar funciones personalizadas | Ver las ejecuciones, exportaciones o programaciones de otras personas |
| Probar y leer orígenes de datos | Usar Seguridad, Registro de auditoría o Migración (solo administradores) |
| Modelar datos en áreas de negocio donde tiene una concesión, hasta el nivel de esa concesión | Modelar datos en un área de negocio donde no tiene concesión |

> **Nota:** **Seguridad**, **Registro de auditoría** y **Migración** son solo para administradores. No aparecen en su barra lateral.

## De dónde procede su acceso

Tres cosas deciden lo que puede hacer.

- **Su rol.** Como Manager, puede ver, ejecutar, exportar, programar y compartir todos los mapas. Esto no depende de los recursos compartidos.
- **Recursos compartidos.** Solo puede cambiar un mapa si es suyo o alguien lo compartió con usted como **Puede editar**. Ser Manager no añade ese derecho.
- **Concesiones de área de negocio.** Un administrador le da una concesión en un área de negocio. Una concesión tiene un nivel. Cada nivel incluye los anteriores.

| Nivel de concesión | Qué le permite hacer en esa área de negocio |
|---|---|
| VIEW | Leer sus datos. Ver sus carpetas, elementos, combinaciones y jerarquías. |
| EXPORT | Igual que VIEW. Los derechos de exportar y programar de un mapa proceden de cómo se comparte el mapa. |
| SCHEDULE | Igual que VIEW. Los derechos de exportar y programar de un mapa proceden de cómo se comparte el mapa. |
| CREATE | Todo lo de VIEW, más crear mapas, carpetas, elementos, combinaciones y jerarquías nuevos. |
| EDIT | Todo lo de CREATE, más cambiar el área y sus carpetas, elementos, combinaciones y jerarquías. |
| DELETE | Todo lo de EDIT, más eliminar carpetas, elementos, combinaciones y jerarquías. |

A diferencia de un administrador, usted no tiene ninguna excepción. De ello se derivan dos reglas.

- Puede ver y ejecutar todos los mapas, pero los datos van en segundo lugar. Una ejecución o una exportación necesita una concesión en cada carpeta que use el mapa. Sin ella, la ejecución falla con **Sin autorización para ejecutar**. Pida la concesión a un administrador.
- Una concesión no hace que aparezcan mapas. Ya ve todos los mapas porque es Manager.

## Cómo iniciar sesión, cambiar la contraseña y cerrar sesión

1. Abra la dirección de Discoverer Neo en su navegador.
2. Escriba su **Correo electrónico** y su **Contraseña**.
3. Deje marcada la casilla **Recordarme** para seguir con la sesión iniciada después de cerrar el navegador. Desmárquela en un ordenador compartido. Así se cierra su sesión al cerrar el navegador.
4. Haga clic en **Iniciar sesión**. Llegará al **Panel**.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

Si escribe una contraseña incorrecta cinco veces, la cuenta se bloquea durante 15 minutos. Espere e inténtelo de nuevo. No hay enlace de "he olvidado mi contraseña". Pida a un administrador que la restablezca.

Si su cuenta tiene una contraseña temporal, Discoverer Neo le envía a **Cambiar la contraseña** y nada más funciona hasta que termine.

Para cambiar su contraseña en cualquier momento, abra la dirección `/change-password` en la misma ventana del navegador. Introduzca su contraseña actual y después la nueva dos veces. La nueva debe tener al menos 12 caracteres y ser distinta de la anterior.

Para cerrar sesión, haga clic en su nombre en la parte superior derecha y elija **Cerrar sesión**. Esto termina su sesión. Para volver a usar Discoverer Neo, inicie sesión de nuevo.

![El menú de la cuenta abierto, con Configuración y Cerrar sesión.](shots/es-ES/common/03-user-menu.png)

---

# Panel

El **Panel** es la primera página que ve. Solo le da cifras. Nada de lo que hay en él cambia datos.

![El panel de Manager con la barra lateral completa y las tarjetas de resumen.](shots/es-ES/manager/01-dashboard-sidebar.png)

| Tarjeta | Qué muestra para usted |
|---|---|
| **Total de mapas** | Todos los mapas activos del sistema. La línea de debajo los divide en "suyos" y "compartidos con usted". Para usted, "compartidos con usted" significa los mapas de todos los demás, incluidos los privados. |
| **Total de ejecuciones** | Todas las ejecuciones registradas, de cualquier persona, de los mapas que puede ver. |
| **Mapas programados** | Mapas que tienen al menos una programación activa creada por usted. |
| **Resultados programados** | Resultados guardados por sus propias programaciones. |
| **Mapas recientes** | Los últimos cinco mapas que creó. Haga clic en uno para abrirlo en el generador. |

El enlace **Ver programaciones** de dos tarjetas abre la página **Programaciones**.

---

# Áreas de negocio

Use esta página para ver las áreas de negocio en las que tiene una concesión y para leer quién más tiene una concesión en ellas.

![La página Áreas de negocio con solo las áreas concedidas al Manager.](shots/es-ES/manager/07-business-areas.png)

La lista muestra solo las áreas en las que tiene una concesión. Si no tiene ninguna, la lista está vacía y todas las páginas de modelado (Áreas de negocio, Carpetas, Elementos, Combinaciones, Jerarquías) no tienen nada con lo que trabajar. Pregunte a un administrador.

| Botón o control | Qué hace |
|---|---|
| Icono de fila **Administrar concesiones** | Abre la lista de concesiones de esa área. Puede leerla. |
| Icono de fila **Editar** | Cambia el nombre y la descripción. Solo funciona con una concesión EDIT o superior en esa área. |
| **Nueva área de negocio** | Reservado a los administradores. |
| Icono de fila **Eliminar** | Reservado a los administradores. |
| **Agregar** y **Revocar** en la lista de concesiones | Reservado a los administradores. |

> **Nota:** La pantalla muestra **Nueva área de negocio**, **Eliminar**, **Agregar** y **Revocar**. El sistema los rechaza en su caso y muestra un error. Solo los administradores crean o eliminan áreas de negocio y dan o quitan concesiones.

Cada concesión de la lista muestra a una persona y un nivel. Apunte al nivel para leer lo que permite.

## Ejemplo: comprobar quién puede crear mapas en un área

1. Haga clic en **Áreas de negocio** en la barra lateral.
2. Haga clic en el icono de fila **Administrar concesiones** del área.
3. Busque personas con CREATE, EDIT o DELETE. Pueden crear mapas en esta área.
4. Haga clic en **Cerrar**.

---

# Carpetas

Una carpeta es una tabla, una vista o una consulta dentro de un área de negocio. Use esta página para listarlas y, donde su concesión lo permita, para agregarlas, cambiarlas o actualizarlas.

![La página Carpetas con un área de negocio elegida y sus carpetas.](shots/es-ES/admin/11-folders.png)

Elija primero un **Área de negocio**. Los botones permanecen desactivados hasta que lo haga.

| Botón o control | Qué hace | Concesión necesaria |
|---|---|---|
| **Área de negocio** | Elige el área cuyas carpetas ve. | Cualquiera |
| **Actualizar todo** | Vuelve a leer todas las tablas y vistas del área desde su base de datos. Las columnas nuevas pasan a ser elementos. Las columnas que faltan solo se enumeran. | EDIT |
| **Nueva carpeta** | Abre el asistente de carpetas. | CREATE |
| Icono de fila **Actualizar desde el origen de datos** | Lo mismo, para una carpeta. Solo se muestra en carpetas de tabla y de vista que no se comparten desde otra área. | EDIT |
| Icono de fila **Gestionar áreas de negocio** | Abre el cuadro de compartición. Puede mirar. Los cambios necesitan EDIT. | Cualquiera para mirar |
| Icono de fila **Editar** | Abre el asistente para cambiar la carpeta. | EDIT |
| Icono de fila **Eliminar** | Desactiva la carpeta después de confirmar. | DELETE |
| **Cerrar** bajo **Resultado de la actualización** | Oculta la lista de resultados de una actualización. | Ninguna |

Una carpeta muestra una insignia **Compartida** cuando pertenece a otra área de negocio y se compartió en esta. Actualícela desde el área a la que pertenece.

La actualización nunca elimina elementos. Las columnas que han desaparecido de la base de datos solo se enumeran, para que pueda eliminarlas usted mismo si ningún mapa las usa.

## El asistente de carpetas

| Campo | Qué significa |
|---|---|
| **Nombre** | El nombre de la carpeta. Se rellena solo cuando elige una tabla. |
| **Descripción** | Texto libre. Se rellena con el comentario de la base de datos cuando elige una tabla. |
| **Tipo de carpeta** | Vea la tabla siguiente. |
| **SQL personalizado** | Se muestra para las carpetas DERIVED y COMPLEX. La consulta que define la carpeta. Una carpeta COMPLEX lo necesita. |
| **Origen de datos** | La conexión a la base de datos. No se muestra para DERIVED y COMPLEX. |
| **Descubrir tablas** | Lee las tablas del origen de datos elegido para que pueda escoger una. Puede usarlo. |
| **Nombre de la tabla** y **Propietario de la tabla** | A qué tabla apunta la carpeta. Se rellenan cuando elige de la lista. |
| **Elementos a crear** | Las columnas de la tabla elegida. Cada columna marcada pasa a ser un elemento. Use **Seleccionar todas** o **Limpiar**. Edite las descripciones antes de guardar. |

| Opción (**Tipo de carpeta**) | Qué significa / cuándo elegirla |
|---|---|
| TABLE | Una tabla de la base de datos. La opción habitual. |
| VIEW | Una vista de la base de datos. |
| DERIVED | Una carpeta definida por su propia consulta. |
| COMPLEX | Una carpeta definida por una consulta más larga. El SQL personalizado es obligatorio. |
| JOIN | Una carpeta creada a partir de una combinación. |
| SUMMARY | Una carpeta de resumen. |

## Ejemplo: agregar una carpeta a partir de una tabla

1. Haga clic en **Carpetas** y después elija el **Área de negocio**. Necesita una concesión CREATE en ella.
2. Haga clic en **Nueva carpeta**.
3. Elija un **Origen de datos** y después haga clic en **Descubrir tablas**.
4. Escriba en **Filtrar por nombre o comentario…** para acotar la lista y después haga clic en la tabla.
5. Desmarque las columnas que no quiera. Ajuste las descripciones.
6. Haga clic en **Guardar**. Primero se crea la carpeta y después sus elementos.

> **Advertencia:** Si **Guardar** muestra "Error al guardar", lo más probable es que le falte la concesión CREATE en esa área.

---

# Elementos

Un elemento es una columna de una carpeta. Use esta página para listar elementos y cambiar cómo se comportan.

![La página Elementos de una carpeta elegida, con la lista de sus elementos.](shots/es-ES/admin/17-items.png)

Elija un **Área de negocio** y después una **Carpeta**. La lista de carpetas permanece vacía hasta que elija un área.

| Botón o control | Qué hace | Concesión necesaria |
|---|---|---|
| **Nuevo elemento** | Abre el cuadro del elemento. | CREATE |
| Icono de fila **Editar** | Cambia el elemento. No puede moverlo a otra carpeta. | EDIT |
| Icono de fila **Eliminar** | Desactiva el elemento después de confirmar. | DELETE |

| Campo | Qué significa |
|---|---|
| **Nombre** | El nombre del elemento que ve la gente en el generador de mapas. |
| **Descripción** | Texto de ayuda opcional. |
| **Tipo de elemento** | El tipo de elemento. Vea más abajo. |
| **Nombre de la columna** | Para un elemento de base de datos: la columna de la base de datos. |
| **Fórmula** | Para todos los tipos salvo un elemento de base de datos: el cálculo. Una fórmula incorrecta se rechaza. |
| **Tipo de datos** | Texto libre, por ejemplo NUMBER. |
| **Máscara de formato** | Cómo se muestra el valor, por ejemplo 999,999.00. |
| **Agregación** | El total predeterminado del elemento. |

| Opción (**Tipo de elemento**) | Qué significa |
|---|---|
| Elemento de base de datos (CO) | Una columna leída directamente de la tabla. |
| Elemento creado (CI) | Un elemento que usted calcula con una fórmula. |
| Elemento calculado (CU) | Un elemento calculado. |
| Elemento de combinación (JI) | Un elemento que llega a través de una combinación. |
| Elemento de jerarquía (HI) | Un elemento usado en una jerarquía. |
| Agregación (AG) | Un elemento que es un total. |
| Función (FU) | Un elemento que llama a una función. |

| Opción (**Agregación**) | Qué significa |
|---|---|
| NONE | Sin total predeterminado. Es una dimensión. |
| SUM | Suma los valores. |
| COUNT | Cuenta las filas. |
| AVG | Calcula la media de los valores. |
| MIN | El valor más pequeño. |
| MAX | El valor más grande. |

---

# Combinaciones

Una combinación le dice a Discoverer Neo cómo se conectan dos carpetas. Sin una, los mapas que usan ambas carpetas se rechazan.

![El cuadro Nueva combinación con dos selectores de carpeta y un par de columnas.](shots/es-ES/admin/21-joins-new-dialog.png)

| Botón o control | Qué hace | Concesión necesaria |
|---|---|---|
| **Área de negocio** | Elige el área. | Cualquiera |
| **Nueva combinación** | Abre el cuadro de la combinación. | CREATE |
| Icono de fila **Editar** | Cambia la combinación. | EDIT |
| Icono de fila **Eliminar** | Desactiva la combinación después de confirmar. | DELETE |
| **Sugerir combinaciones** | Propone columnas que coinciden para la carpeta izquierda. Haga clic en una sugerencia para usarla. | VIEW |
| **Añadir par de columnas** | Agrega un par más de elementos. Todos los pares deben coincidir a la vez. | CREATE o EDIT |
| X junto a un par | Quita ese par. Debe quedar un par. | CREATE o EDIT |

| Campo | Qué significa |
|---|---|
| **Nombre** | El nombre de la combinación. Se rellena a partir de una sugerencia si se deja vacío. |
| **Carpeta izquierda** y **Carpeta derecha** | Las dos carpetas que se conectan. Ambas pertenecen al área elegida. |
| **Elemento izquierdo**, **Operador**, **Elemento derecho** | Un par: qué columnas se comparan y cómo. |
| **Tipo de combinación** | Vea más abajo. |

| Opción (**Operador**) | Qué significa |
|---|---|
| = | Igual. Casi siempre es la opción correcta. |
| <> | Distinto. |
| < y <= | Menor que, menor o igual que. |
| > y >= | Mayor que, mayor o igual que. |

| Opción (**Tipo de combinación**) | Qué significa / cuándo elegirla |
|---|---|
| INNER | Solo las filas que coinciden en ambos lados. |
| LEFT | Todas las filas de la carpeta izquierda, aunque no coincidan. |
| RIGHT | Todas las filas de la carpeta derecha, aunque no coincidan. |

## Ejemplo: combinar dos carpetas

1. Haga clic en **Combinaciones** y elija el **Área de negocio**. Necesita una concesión CREATE.
2. Haga clic en **Nueva combinación**.
3. Elija la **Carpeta izquierda** y la **Carpeta derecha**.
4. Haga clic en **Sugerir combinaciones** y después en la mejor sugerencia. O elija usted mismo el **Elemento izquierdo**, el **Operador** y el **Elemento derecho**.
5. Deje el **Tipo de combinación** en INNER salvo que necesite filas sin coincidencia.
6. Haga clic en **Guardar**.

---

# Jerarquías

Una jerarquía es una lista ordenada de elementos para el desglose, por ejemplo Año, Trimestre, Mes.

![Un cuadro de jerarquía con una fila de nivel que muestra el nombre y los selectores de carpeta y elemento.](shots/es-ES/admin/26-hierarchies-level-added.png)

| Botón o control | Qué hace | Concesión necesaria |
|---|---|---|
| **Área de negocio** | Elige el área. | Cualquiera |
| **Nueva jerarquía** | Abre un cuadro vacío. | CREATE |
| Icono de fila **Editar** | Abre la jerarquía. Puede abrirla con VIEW, pero guardar necesita EDIT. | EDIT para guardar |
| Icono de fila **Eliminar** | Desactiva la jerarquía después de confirmar. | DELETE |
| **Agregar nivel** | Agrega un nivel al final. | CREATE o EDIT |
| Asa de arrastre | Arrastre un nivel hacia arriba o hacia abajo. El orden es el orden de desglose. | CREATE o EDIT |
| X en un nivel | Quita el nivel. | CREATE o EDIT |

Cada nivel necesita un **Nombre del nivel**, una **Carpeta** y un **Elemento**. **Guardar** permanece desactivado hasta que estén completos el nombre, al menos un nivel y todos los niveles. Elija elementos de carpetas que pertenezcan al área de negocio. Una carpeta compartida desde otra área aparece en la lista, pero el guardado falla.

---

# Funciones personalizadas

Una función personalizada es una función almacenada en la base de datos de Oracle que pueden llamar los elementos calculados. Aquí tiene todos los derechos. No se necesita concesión de área de negocio.

![La página Funciones personalizadas con la lista, Actualizar todo y Nueva función.](shots/es-ES/manager/09-custom-functions.png)

| Botón o control | Qué hace |
|---|---|
| **Filtrar por nombre o función de la base de datos…** | Acota la lista mientras escribe. |
| **Actualizar todo** | Vuelve a leer todas las funciones desde Oracle. Las firmas modificadas se guardan y los campos calculados se recompilan. Las funciones que ya no están en Oracle se conservan y se enumeran. |
| **Nueva función** | Abre el cuadro de la función. |
| Icono de fila **Actualizar desde la base de datos** | Actualiza una función. |
| Icono de fila **Editar** | Cambia la función. |
| Icono de fila **Eliminar** | Desactiva la función después de confirmar. |
| **Cerrar** bajo **Resultado de la actualización** | Oculta la lista de resultados. |

| Campo | Qué significa |
|---|---|
| **Origen de datos** | La base de datos donde está la función. |
| **Propietario**, **Buscar una función**, **Buscar** | Busca funciones y paquetes en Oracle. Solo orígenes de datos Oracle. |
| **Propietario**, **Paquete**, **Nombre de la función**, **Enlace de base de datos** | Las partes del nombre completo. Solo letras, dígitos, _, $ o #, empezando por una letra. |
| **Nombre** y **Descripción** | El nombre para mostrar y una nota. |
| **Tipo de función** | Vea más abajo. |
| **Tipo de retorno** | Por ejemplo NUMBER. |
| **Parámetros (JSON)** | La lista de entradas. Cada una necesita un nombre y un tipo. |

| Opción (**Tipo de función**) | Qué significa |
|---|---|
| SQL | Una función SQL simple. |
| PLSQL | Una función PL/SQL almacenada. El valor predeterminado. |
| PACKAGE | Una función dentro de un paquete de Oracle. |

## Ejemplo: registrar una función de paquete

1. Haga clic en **Funciones personalizadas** y después en **Nueva función**.
2. Elija el **Origen de datos**.
3. Escriba parte del nombre en **Buscar una función** y después haga clic en **Buscar**.
4. Haga clic en el resultado correcto. Se rellenan el tipo, el propietario, el paquete, el tipo de retorno y los parámetros. Los resultados que Oracle no puede llamar desde SQL aparecen en gris.
5. Compruebe el **Nombre** y después haga clic en **Guardar**.

---

# Orígenes de datos

Un origen de datos es una conexión guardada a una base de datos. Puede consultarlos y probarlos. No puede cambiarlos.

![La página Orígenes de datos con la lista de conexiones y los iconos de fila.](shots/es-ES/manager/08-data-sources.png)

| Botón o control | Qué hace |
|---|---|
| Icono de fila **Probar conexión** | Prueba el inicio de sesión guardado. Un mensaje dice **Conexión establecida** o **Error de conexión**. |
| Icono de fila **Inspeccionar esquema** | Lee el esquema de Oracle para encontrar sus tablas. Muestra cuántas tablas se encontraron. Solo Oracle. |
| **Nuevo origen de datos** | Reservado a los administradores. |
| Icono de fila **Editar** | Reservado a los administradores. |
| Icono de fila **Eliminar** | Reservado a los administradores. |
| Icono de fila **Importar tablas** | Puede abrir el cuadro y **Descubrir tablas**. **Importar** está reservado a los administradores. |

> **Nota:** La pantalla ofrece **Nuevo origen de datos**, **Editar**, **Eliminar** y el paso de importación. El sistema los rechaza en su caso. Para crear carpetas a partir de tablas, use en su lugar **Carpetas** y **Descubrir tablas**.

---

# Usuarios

La página **Usuarios** es de solo lectura para usted. Úsela para ver cuentas, para averiguar qué mapas puede abrir una persona y para corregir quién es propietario de un mapa o lo comparte.

![La lista de Usuarios de solo lectura, sin los botones Nuevo usuario ni Archivo de credenciales.](shots/es-ES/manager/06-users.png)

La lista muestra **Nombre**, **Correo electrónico**, **Rol** y **Estado** (**Activo** o **Inactivo**). No puede crear, editar, desactivar, activar ni eliminar usuarios. No puede emitir un archivo de credenciales. Pídalo a un administrador.

## Mapas de una persona

Haga clic en el icono de fila **Mapas que este usuario puede abrir**. El cuadro **Mapas de {name}** muestra todos los mapas que esa persona ve.

![El cuadro Mapas de un usuario, con selectores de nivel de acceso compartido e iconos de propietario y de quitar.](shots/es-ES/manager/12-users-maps-dialog.png)

| Botón o control | Qué hace |
|---|---|
| Nombre del mapa | Abre el mapa en el visor. |
| **Propietario: {name}** | Muestra quién es el propietario del mapa. |
| Insignia | Dice por qué la persona ve el mapa. |
| Selector de nivel de acceso compartido | Cambia lo que la persona puede hacer con un mapa compartido. |
| Icono de propietario | Abre la lista **Nuevo propietario**. |
| **Nuevo propietario** | Elija a una persona a quien entregar el mapa. |
| Icono de quitar (X) | Quita el mapa a esa persona. Sin confirmación. |

| Opción (insignia) | Qué significa |
|---|---|
| Administrador | La persona es administradora y ve todos los mapas. |
| Propietario | La persona es propietaria del mapa. |
| Compartido | Alguien compartió el mapa con la persona. Puede cambiarlo o quitarlo. |
| Público | El mapa es público. |
| Rol de gestor | La persona es Manager y ve todos los mapas. |

| Opción (nivel de acceso compartido) | Qué significa / cuándo elegirla |
|---|---|
| Puede ver | Puede abrir y ejecutar el mapa. No puede exportarlo, programarlo ni cambiarlo. |
| Puede exportar | Puede abrir y ejecutar el mapa, exportar su resultado y ponerlo en una programación. |
| Puede editar | Puede hacer todo lo anterior y además cambiar el mapa. |

## Ejemplo: entregar un mapa a un compañero que se hace cargo

1. Haga clic en **Usuarios** y después en el icono de fila **Mapas que este usuario puede abrir** del propietario actual.
2. Busque el mapa. Haga clic en el icono de propietario.
3. En **Nuevo propietario**, elija al compañero.
4. Espere al mensaje **Propietario cambiado**.

> **Advertencia:** El nuevo propietario puede cambiar, compartir y eliminar el mapa. Se descarta su propio recurso compartido anterior del mapa. No pasa a ser editor del mapa por entregarlo.

---

# Mapas

La página **Mapas** muestra todos los mapas del sistema. Usted ve todo, incluidos los mapas privados. Ver un mapa no significa que pueda leer sus datos. Siguen aplicándose las reglas de datos del primer capítulo.

![La lista de Mapas, pestaña Todos, con los iconos Copiar, Compartir, Programar y Exportar en cada fila.](shots/es-ES/manager/02-maps-all.png)

## Buscar un mapa

| Control | Qué hace |
|---|---|
| Pestaña **Míos** | Mapas que usted creó. |
| Pestaña **Compartidos conmigo** | Mapas que alguien compartió con usted en cualquier nivel. |
| Pestaña **Todos** | Todos los mapas del sistema. |
| **Buscar mapas por nombre…** | Filtra por nombre. |
| Filtro **Área de negocio** | Muestra un área de negocio. Elija **Todas las áreas de negocio** para restablecer. |
| **Ordenar por** | **Actualizado recientemente** o **Nombre (A–Z)**. |
| **Limpiar** | Restablece la búsqueda y el filtro. |

La sección **Libros de trabajo** de la parte superior agrupa los mapas por libro. Haga clic en un libro para ver sus mapas. Haga clic en un mapa para abrirlo.

## Qué hace cada icono

| Icono | Qué hace |
|---|---|
| Ojo | Abre el visor para que pueda ejecutar el mapa. |
| Lápiz | Abre el generador. Solo se muestra en mapas que son suyos o que se han compartido con usted como **Puede editar**. |
| Copiar | Crea su propia copia, que después puede cambiar. Funciona con cualquier mapa. |
| Compartir | Abre **Compartir mapa**. Funciona con cualquier mapa. |
| Calendario | Abre **Programaciones** con este mapa elegido. |
| Descargar | Abre el visor, donde exporta. |
| Papelera | Elimina el mapa. Solo se muestra en sus propios mapas. |

La fila de un libro tiene sus propios iconos. Copiar crea una copia privada de todos los mapas del libro. Compartir da a alguien todos los mapas del libro. La papelera elimina un libro solo si es propietario de todos los mapas que contiene.

> **Advertencia:** Solo un administrador puede recuperar un mapa eliminado.

## Copiar un mapa para crear el suyo

1. Busque el mapa y haga clic en el icono Copiar.
2. En un libro, escriba un nombre en **Nombre del libro nuevo** y haga clic en **Copiar**.
3. La copia se abre en el generador. Es privada para usted.

Ejemplo: copie **GD_M.M10_V01.DIS** y después agregue una columna a su copia. El original no cambia.

## Compartir un mapa

1. Haga clic en el icono Compartir del mapa.
2. Busque a una persona por nombre o correo electrónico.
3. Haga clic en un nivel junto a su nombre: **Puede ver**, **Puede exportar** o **Puede editar**. El botón oscuro es el que tiene ahora.
4. Para quitar el acceso, haga clic en la X junto a su nombre.

![El cuadro Compartir mapa con un cuadro de búsqueda y los botones Puede ver, Puede exportar y Puede editar.](shots/es-ES/manager/03-share-dialog.png)

El cuadro también muestra un aviso cuando el mapa es público, con **Copiar enlace**. Cualquier persona con el enlace puede verlo. Este cuadro no cambia un mapa entre público y privado. Ese cambio está en la pestaña **Propiedades** del mapa, y solo puede guardarlo quien pueda editar el mapa.

En un libro, el mismo cuadro reparte un mismo recurso compartido entre todos los mapas del libro que puede ver. Le dice qué mapas no se pudieron compartir.

---

# Generador de mapas

Use el generador para crear un mapa o cambiar uno. Se accede con **Crear Mapa**, con el icono del lápiz o copiando un mapa.

![El generador de mapas con el árbol Áreas de negocio, el lienzo de columnas y el panel Propiedades.](shots/es-ES/user/05-builder-overview.png)

## Qué puede guardar

| Situación | ¿Puede guardar? |
|---|---|
| Un mapa nuevo | Sí, si tiene una concesión CREATE o superior en el área de negocio. |
| Un mapa que es suyo | Sí. |
| Un mapa compartido con usted como **Puede editar** | Sí. |
| Cualquier otro mapa | No. El guardado falla con "Forbidden". Copie primero el mapa y después edite su copia. |

El generador se abre para todos los mapas, incluso uno que no puede guardar. Solo lo descubre al hacer clic en **Guardar**.

## La barra de herramientas

| Botón o control | Qué hace |
|---|---|
| **Atrás** | Vuelve a la página de la que venía. Los cambios sin guardar se pierden sin aviso. |
| Cuadro del nombre del mapa | Establece el nombre del mapa. |
| Lista de tipo de mapa | **Tabla**, **Tabla cruzada**, **Página-Detalle** o **Gráfico**. Solo **Tabla cruzada** cambia el aspecto del resultado. Los demás se muestran como una tabla simple. |
| **● Sin guardar** | Le recuerda que hay cambios que no ha guardado. |
| **Ejecutar** | Guarda el mapa si es nuevo o ha cambiado y después lo ejecuta. |
| **Guardar** | Guarda sus cambios. Nada se guarda solo. |
| **Exportar** > **Definición del mapa (.xml)** | Descarga la definición del mapa. No contiene filas de datos. Necesita un mapa guardado. |
| **Programar** | Abre **Programaciones** con este mapa elegido. Necesita un mapa guardado. |
| **Formato** | Abre el formato condicional. Necesita un mapa guardado. |
| **Compartir** | Abre **Compartir mapa**. Necesita un mapa guardado. |

## Crear un mapa

1. En el árbol **Áreas de negocio** de la izquierda, abra un área de negocio y una carpeta. Solo se muestran las áreas en las que tiene una concesión.
2. Arrastre elementos al lienzo **Columnas**, o haga clic en el botón más junto a un elemento. Las medidas tienen un icono de sigma y las dimensiones un icono de etiqueta.
3. Todas las columnas de un mapa deben proceder de un área de negocio. La primera columna que agregue decide cuál.
4. Haga clic en una columna para abrir **Configurar columna**. Cambie lo que necesite y después haga clic en **Guardar** en ese cuadro.
5. Agregue condiciones, ordenación y parámetros en las pestañas de la derecha.
6. Haga clic en **Guardar** en la barra de herramientas. Después haga clic en **Ejecutar**.

Use **Filtrar elementos…** encima del árbol para encontrar un elemento por nombre.

## Configurar columna

| Campo | Qué hace |
|---|---|
| **Nombre para mostrar** | Encabezado de la columna. En blanco, usa el nombre del elemento. |
| **Agregación** | Total de esta columna. |
| **Dirección de ordenación** | **Ninguno**, **Ascendente** o **Descendente**. |
| **Máscara de formato** | Cómo se ven los números y las fechas. **Predefinidos** la rellena por usted. |
| **Orden de clasificación** | Posición de esta columna cuando ordena por varias. |
| **Ancho de columna (px)** | Ancho en píxeles. |
| **Colocación** | Vea más abajo. |
| **Borde de la tabla cruzada** | Dónde va una columna de eje en una tabla cruzada. |
| **Agrupar y cortar** | Oculta los valores repetidos y empieza un subtotal cuando cambia el valor. |
| **Solo consulta, no mostrar** | La consulta usa la columna, pero el resultado la oculta. |

| Opción (**Colocación**) | Qué significa |
|---|---|
| Ninguno | Sin función especial. |
| Agrupar por (eje) | La columna agrupa las filas. |
| Medida | La columna contiene un valor que se totaliza. |
| Elemento de página | La columna pasa a ser un filtro de página. |

| Opción (**Borde de la tabla cruzada**) | Qué significa |
|---|---|
| Ninguno | No se usa en una tabla cruzada. |
| En el lateral | Los valores van por el lado izquierdo, hacia abajo. |
| En la parte superior | Los valores van por la parte superior, a lo ancho. |

| Opción (**Predefinidos**) | Qué rellena |
|---|---|
| Número (1.234) | 999,999,999 |
| Decimal (1.234,00) | 999,999,999.00 |
| Moneda (1.234,00 €) | $999,999,999.00 |
| Porcentaje (12,3 %) | 990.0% |
| Fecha (DD-MON-YYYY) | DD-MON-YYYY |
| Fecha (YYYY-MM-DD) | YYYY-MM-DD |

## Las cinco pestañas de configuración

| Pestaña | Para qué sirve |
|---|---|
| **Propiedades** | La **Descripción** que se imprime encima de los resultados y en cada exportación, la casilla **Público (visible para todos en el área de negocio)** y los recuentos. **Insertar variable** agrega valores como la fecha de ejecución. |
| **Condiciones** | Filtros. |
| **Ordenación** | Niveles de ordenación. |
| **Parámetros** | Preguntas que se hacen cuando se ejecuta el mapa. |
| **Campos calculados** | Columnas nuevas a partir de una fórmula. |

> **Advertencia:** **Público** hace que el mapa sea visible y exportable para todas las personas con sesión iniciada, no solo para las de su área de negocio. Se siguen aplicando sus derechos de datos.

**Condiciones.** Haga clic en **Agregar condición**. Elija el **Elemento de condición**, un **Operador** y un valor. Elija **Valor estático** para un valor fijo, o **Solicitar en tiempo de ejecución** para preguntar cada vez. Para una solicitud, dé al parámetro un nombre que haya definido en la pestaña **Parámetros**. Seleccione dos o más condiciones y haga clic en **Agrupar** para unirlas con OR. Use **Desagrupar** para deshacerlo.

| Opción (**Operador**) | Qué significa |
|---|---|
| = | Igual a. |
| <> | Distinto de. |
| < y > | Menor que, mayor que. |
| <= y >= | Menor o igual que, mayor o igual que. |
| LIKE | Coincide con un patrón con % y _. |
| IN | Coincide con cualquiera de una lista, separados por comas. |
| BETWEEN | Entre dos valores, primero el menor y después el mayor. |
| IS NULL | El valor está vacío. |

**Ordenación.** Elija una columna, haga clic en **Agregar ordenación** y después elija **Ascendente** o **Descendente**. Arrastre un nivel para cambiar su prioridad.

**Parámetros.** Haga clic en **Agregar parámetro**. Dele un nombre único, un tipo y, si quiere, un valor predeterminado. Marque **Obligatorio** para rechazar una respuesta en blanco. Si todos los parámetros tienen valor predeterminado, **Ejecutar** omite la pregunta.

| Opción (tipo de parámetro) | Qué significa |
|---|---|
| STRING | Texto. |
| NUMBER | Un número. |
| DATE | Una fecha. |
| LIST | Varios valores separados por comas. |

**Campos calculados.** Haga clic en **Agregar campo calculado**, póngale nombre y después haga clic en el botón de la fórmula. En el **Editor de fórmulas**, escriba una fórmula o haga clic en los botones de funciones y de columnas para insertarlos. **Probar fórmula** la ejecuta sobre las cinco primeras filas de un mapa guardado. Necesita una concesión sobre los datos.

## Formato condicional

Haga clic en **Formato** para colorear celdas o filas completas según una regla, por ejemplo en rojo cuando un valor es menor que cero. Las reglas se guardan al instante y no forman parte de **Guardar**. Debe ser propietario del mapa o tener **Puede editar** en él para agregar o eliminar reglas. En caso contrario, el sistema lo rechaza con "Forbidden".

| Campo | Qué significa |
|---|---|
| **Columna** | La columna que se comprueba. |
| **Aplicar a** | **Celda** o **Fila**. |
| **Operador** | **Igual a**, **Distinto de**, **Mayor que**, **Menor que**, **Mayor o igual que**, **Menor o igual que**, **Contiene (comodines % y _)**, **En la lista**, **Entre** o **Está vacío**. |
| **Valor** | Con qué comparar. Oculto para **Está vacío**. |
| **Color de fondo**, **Color de texto** | Colores. **Borrar** quita uno. |
| **Negrita**, **Cursiva**, **Subrayado** | Estilo del texto. |

## Mapas rechazados

Algunas formas de mapa se rechazan antes de ejecutarse, por ejemplo carpetas sin combinación, o totales que se contarían dos veces. Un cuadro ámbar explica por qué y qué cambiar. Agregue una combinación, quite columnas o divida el mapa en dos.

---

# Visor de mapas

El visor ejecuta un mapa y muestra sus filas. Nunca cambia el mapa. Se accede con el icono del ojo, o desde **Ejecuciones** y **Exportaciones**.

![Una ejecución completada con los botones Excel, CSV y PDF sobre la cuadrícula de resultados.](shots/es-ES/viewer/06-viewer-results.png)

| Botón o control | Qué hace |
|---|---|
| **Ejecutar** | Ejecuta el mapa. Si un parámetro no tiene valor predeterminado, primero se abre **Parámetros de ejecución**. |
| **Ejecutar de nuevo** | Tras una ejecución terminada, pide una ejecución nueva con los mismos valores. |
| **Cancelar** | Cancela una ejecución que aún espera en la cola. Una ejecución ya en curso no se puede cancelar aquí. |
| **Administración de programaciones** | Abre **Programaciones**. |
| **Excel**, **CSV**, **PDF** | Exportan el resultado terminado. |
| **Cargar más** | Carga las 500 filas siguientes. |
| Clic en el encabezado | Ordena por esa columna. |
| **Filtrar…** bajo un encabezado | Filtra las filas ya cargadas. |
| Doble clic en una fila | Abre **Ver detalle**, las filas sin procesar que hay detrás de esa fila. |

La línea de estado bajo **Ejecutar** indica si el resultado es nuevo o se reutilizó. Un resultado sigue siendo válido durante 24 horas. Si vuelve a ejecutar el mismo mapa con los mismos valores en ese tiempo, obtiene el resultado guardado. Use **Ejecutar de nuevo** para forzar uno nuevo.

**Ejecutar** y **Exportar** necesitan una concesión en cada carpeta del mapa. Sin ella aparece un cuadro rojo **Sin autorización para ejecutar**. Pida la concesión a un administrador.

No ve los botones **SQL** y **Plan**. Son para administradores.

El cuadro **Parámetros de ejecución** hace una pregunta por parámetro. Una estrella roja marca uno obligatorio. Cuando el parámetro alimenta un filtro sobre un elemento, un selector sugiere los valores reales. Necesita una concesión en esa área.

## Exportar a PDF

Haga clic en **PDF** para abrir **Exportar a PDF**.

| Campo | Qué significa |
|---|---|
| **Tamaño del papel** | **A4**, **A3** o **Carta**. |
| **Orientación** | **Vertical** u **Horizontal**. |
| **Columnas** | Marque las columnas que se imprimirán. **Seleccionar todas** y **Limpiar** las alternan todas. |

Haga clic en **Exportar**. La descripción del mapa se imprime en la parte superior de la primera página.

## Ejemplo: ejecutar y exportar GD_M.M10_V01.DIS

1. Abra **Mapas**, busque **GD_M.M10_V01.DIS** y haga clic en el icono del ojo.
2. Haga clic en **Ejecutar**. Responda a las preguntas si aparece alguna.
3. Cuando aparezcan las filas, haga clic en **Excel**.
4. Abra **Exportaciones** para descargar el archivo.

---

# Programaciones

Una programación ejecuta un mapa por sí sola según un horario y guarda el resultado. Solo ve sus propias programaciones, aunque puede programar cualquier mapa.

![La página Programaciones con una programación en pausa y sus iconos de acción.](shots/es-ES/user/38-schedules-list.png)

Para programar un mapa que no es suyo, use el icono del calendario de la página **Mapas**. La lista de mapas del cuadro **Nueva programación** contiene solo sus propios mapas y los mapas compartidos con usted.

Una programación se ejecuta como usted. Sus concesiones de área de negocio deciden si puede leer los datos.

| Botón o control | Qué hace |
|---|---|
| **Nueva programación** | Abre el cuadro. |
| Icono de fila **Ejecutar ahora** | La ejecuta de inmediato. No disponible mientras está en pausa. |
| Icono de fila **Pausar** o **Habilitar** | Desactiva o activa la programación. |
| Icono de fila **Historial** | Abre **Historial de ejecución**. |
| Icono de fila **Editar** | Cambia la programación. No puede cambiar su mapa. |
| Icono de fila **Eliminar** | Elimina la programación y su historial después de confirmar. No se puede deshacer. |

La columna **Estado** muestra **Activa** o **En pausa**. La columna **Planificador** la rellena la migración. No puede cambiarla.

| Campo del cuadro | Qué significa |
|---|---|
| **Mapa** | El mapa que se ejecuta. |
| **Nombre** | El nombre de la programación. |
| **Frecuencia** | Vea más abajo. |
| **Zona horaria** | El reloj que usan las horas. Por defecto UTC. |
| **Expresión cron** | Se muestra para **Personalizada**. Cinco campos: minuto, hora, día del mes, mes, día de la semana. |
| **Válida desde** y **Válida hasta** | Fechas opcionales. La programación se ejecuta solo entre ellas. |
| **Formato de salida** | Vea más abajo. |
| **Valores predefinidos de parámetros** | El valor que se usa cada vez para cada parámetro del mapa. |
| **Habilitada** | Desactivada significa que nunca se ejecuta por sí sola. |

| Opción (**Frecuencia**) | Qué significa |
|---|---|
| Diaria (medianoche) | Cada día a las 00:00. |
| Semanal (domingo, medianoche) | Cada domingo a las 00:00. |
| Mensual (día 1, medianoche) | El día 1 de cada mes a las 00:00. |
| Personalizada | Usted escribe la expresión cron. Ejemplo: `0 9 * * 1-5` es las 09:00 los días laborables. |

| Opción (**Formato de salida**) | Qué significa |
|---|---|
| Excel (.xlsx) | Una hoja de cálculo. |
| CSV | Una tabla de texto sin formato. El valor predeterminado. |

**Historial de ejecución** muestra los últimos 50 resultados con **Ejecutado**, **Estado**, **Filas** y **Duración**. Cada uno tiene los botones **XLSX**, **CSV** y **PDF** y un icono **Abrir**. Los resultados se conservan 30 días. Después desaparecen los botones de exportación.

## Ejemplo: programar una ejecución semanal

1. En **Mapas**, haga clic en el icono del calendario del mapa.
2. Escriba un **Nombre**. Establezca la **Frecuencia** en **Semanal (domingo, medianoche)**.
3. Elija su **Zona horaria** y el **Formato de salida**.
4. Haga clic en **Guardar**.
5. Haga clic en el icono **Ejecutar ahora** para comprobar que funciona. Después abra **Historial**.

---

# Ejecuciones

**Ejecuciones** muestra todas las ejecuciones que ha pedido, estén en espera, en curso o terminadas. Muestra solo sus propias ejecuciones, no las de otras personas.

![La página Ejecuciones con los filtros Mapa, Estado y Tipo y la lista de ejecuciones.](shots/es-ES/manager/11-runs.png)

| Botón o control | Qué hace |
|---|---|
| Filtros **Mapa**, **Estado**, **Tipo** | Acotan la lista. **Tipo** es **En directo** o **Programada**. |
| Nombre del mapa | Abre el visor. |
| Icono **Abrir** | Abre el resultado guardado de esa ejecución. |
| Icono **Ejecutar de nuevo** | Pide la misma ejecución otra vez. |
| **XLSX**, **CSV**, **PDF** | Exportan una ejecución terminada que no ha expirado. |
| Icono **Cancelar** | Cancela una ejecución que sigue en cola. |
| Icono **Eliminar** | Elimina una ejecución terminada y sus filas guardadas. No se puede deshacer. |

La columna **Expira en** muestra cuánto tiempo se conserva el resultado. La casilla **Mostrar ejecuciones de todos los usuarios** es solo para administradores, así que usted no la ve. Una ejecución de un mapa que ya no puede abrir desaparece de su lista.

---

# Exportaciones

**Exportaciones** muestra los archivos que ha pedido. Solo ve los suyos.

![La página Exportaciones con la lista de trabajos de exportación y un botón Descargar en los terminados.](shots/es-ES/user/44-exports.png)

| Botón o control | Qué hace |
|---|---|
| Icono **Descargar** | Descarga un archivo terminado. |

El **Estado** muestra **En cola**, **En curso**, **Completada** o **Fallida**. Apunte a un estado fallido para leer el motivo. Los archivos se conservan 7 días. Después la descarga falla. Vuelva a exportar desde una ejecución nueva.

---

# Configuración

Abra **Configuración** desde la barra lateral o desde el menú de su nombre. Las elecciones se conservan para su cuenta en todos los ordenadores, pero solo después de hacer clic en **Guardar**.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

| Control | Qué hace |
|---|---|
| **Idioma de visualización** | **English**, **Português (Portugal)**, **Français (France)** o **Español (España)**. |
| **Apariencia** | **Claro**, **Oscuro** o **Alto contraste**. |
| **Paleta** | **Clásica**, **Azul marino**, **Bosque**, **Vino**, **Océano** u **Ocre**. Desactivada mientras **Alto contraste** está activo. |
| **Guardar** | Conserva sus elecciones. |

Si sale sin guardar, este navegador muestra la elección nueva, pero su cuenta sigue conservando la anterior.

---

# Preguntas frecuentes

**¿Por qué veo un mapa pero la ejecución dice "Sin autorización para ejecutar"?**
Como Manager, usted ve todos los mapas. Sus datos necesitan una concesión de área de negocio en cada carpeta que usa. Pregunte a un administrador.

**¿Por qué no hay icono de lápiz en un mapa?**
Solo puede editar sus propios mapas y los mapas compartidos con usted como **Puede editar**. Haga clic en el icono Copiar y después cambie su copia. O pida al propietario que lo comparta con usted como **Puede editar**.

**Las listas de Áreas de negocio, Carpetas, Elementos, Combinaciones y Jerarquías están vacías.**
Estas páginas muestran solo las áreas de negocio en las que tiene una concesión. Pida una a un administrador. CREATE le permite agregar, EDIT le permite cambiar y DELETE le permite eliminar.

**Hice clic en algo y salió "Forbidden" o "Error al guardar".**
La pantalla lo ofrecía, pero su rol o su concesión no lo permiten. Los casos más habituales son **Nueva área de negocio**, **Nuevo origen de datos**, **Importar** y guardar un mapa que no es suyo.

**No puedo ver las ejecuciones, exportaciones o programaciones de otra persona.**
Las ejecuciones, exportaciones y programaciones pertenecen a quien las creó. Nadie más que esa persona las ve en la lista, y lo mismo vale para usted.

**Un compañero se ha ido. ¿Cómo conservo sus mapas?**
Abra **Usuarios**, haga clic en **Mapas que este usuario puede abrir** y use el icono de propietario de cada mapa para entregarlo a otra persona.

**Una programación que creé no se ejecuta.**
Compruebe que su **Estado** es **Activa**, que las fechas de **Válida desde** y **Válida hasta** cubren hoy y que sigue teniendo una concesión sobre los datos. Una programación se ejecuta como usted.

**La descarga de mi exportación dice que falló.**
Los archivos se conservan 7 días. Vuelva a ejecutar el mapa y exporte el resultado nuevo.

**No puedo cambiar mi contraseña si la olvido.**
No hay enlace de restablecimiento. Pida ayuda a un administrador.

---

# Glosario

| Término | Significado |
|---|---|
| Mapa | Un informe. En Oracle Discoverer era una hoja de trabajo. |
| Libro | Un grupo de mapas. |
| Área de negocio | Un grupo de datos relacionados. |
| Carpeta | Una tabla, vista o consulta dentro de un área de negocio. |
| Elemento | Una columna de una carpeta. Una dimensión agrupa filas. Una medida contiene valores que se totalizan. |
| Combinación | La regla que conecta dos carpetas. |
| Jerarquía | Una lista ordenada de elementos para el desglose. |
| Concesión | Acceso a un área de negocio dado por un administrador, con un nivel. |
| Recurso compartido | Acceso a un mapa dado a una persona, con un nivel: **Puede ver**, **Puede exportar** o **Puede editar**. |
| Mapa público | Un mapa que cualquier persona con la sesión iniciada puede ver y exportar. Se siguen aplicando sus derechos de datos. |
| Ejecución | Una vez que se ejecuta un mapa. Sus filas se guardan 24 horas. |
| Exportación | Un archivo (Excel, CSV o PDF) creado a partir de una ejecución terminada. |
| Programación | Un horario que ejecuta un mapa por sí solo y guarda el resultado. |
| Origen de datos | Una conexión guardada a una base de datos. |
| Función personalizada | Una función de la base de datos que pueden llamar los elementos calculados. |
