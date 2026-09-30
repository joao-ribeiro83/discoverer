# Su rol en una página

Usted es **Manager**. Ve, ejecuta, exporta, programa y comparte todos los mapas. El modelado de datos se limita a las áreas de negocio en las que un administrador le ha dado una concesión.

| Puede | No puede |
|---|---|
| Ver, ejecutar, exportar y programar todos los mapas | Cambiar o eliminar un mapa que no es suyo (salvo que se haya compartido con usted como **Puede editar**) |
| Compartir cualquier mapa y cambiar cualquier recurso compartido | Ver el SQL o el plan de la base de datos |
| Copiar cualquier mapa para crear el suyo | Crear usuarios, orígenes de datos o áreas de negocio, ni dar concesiones |
| Entregar un mapa a un nuevo propietario | Ver las ejecuciones, exportaciones o programaciones de otras personas |
| Gestionar funciones personalizadas | Usar Seguridad, Registro de auditoría o Migración |
| Leer, probar e inspeccionar orígenes de datos | Importar tablas desde un origen de datos |

> **Nota:** **Seguridad**, **Registro de auditoría** y **Migración** son solo para administradores. No aparecen en su barra lateral.

Ver un mapa no le da sus datos. Una ejecución necesita una concesión de área de negocio en cada carpeta que use el mapa. Sin ella verá **Sin autorización para ejecutar**.

Inicie sesión con su **Correo electrónico** y su **Contraseña** y haga clic en **Iniciar sesión**. Para salir, use **Cerrar sesión** en el menú de su nombre.

---

# Mapas

La página **Mapas** muestra todos los mapas. Un mapa es un informe (una hoja de trabajo en Oracle Discoverer).

![La lista de Mapas, pestaña Todos, con los iconos Copiar, Compartir, Programar y Exportar en cada fila.](shots/es-ES/manager/02-maps-all.png)

1. Elija una pestaña: **Míos**, **Compartidos conmigo** o **Todos**.
2. Acote la lista con **Buscar mapas por nombre…** o con el filtro **Área de negocio**.
3. Haga clic en el icono del ojo para abrir un mapa y ejecutarlo.
4. Haga clic en el icono Copiar para hacer su propia copia. Es privada para usted.
5. Haga clic en el icono Compartir para dar acceso a alguien.

| Icono | Qué hace |
|---|---|
| Lápiz | Cambia el mapa. Solo sus propios mapas o recursos compartidos con **Puede editar**. |
| Papelera | Elimina. Solo sus propios mapas. Un administrador debe restaurarlo. |
| Calendario | Programa este mapa. |

---

# Compartir un mapa

Compartir decide lo que otra persona puede hacer con un mapa.

![El cuadro Compartir mapa con un cuadro de búsqueda y los botones Puede ver, Puede exportar y Puede editar.](shots/es-ES/manager/03-share-dialog.png)

1. Haga clic en el icono Compartir del mapa.
2. Busque a una persona por nombre o correo electrónico.
3. Haga clic en un nivel junto a su nombre. El botón oscuro es su nivel actual.
4. Haga clic en la X junto a un nombre para quitar el acceso.

| Nivel | Qué significa |
|---|---|
| **Puede ver** | Solo abrir y ejecutar. |
| **Puede exportar** | Además, exportar y programar. |
| **Puede editar** | Además, cambiar el mapa. |

---

# Ver, ejecutar y exportar

El visor ejecuta un mapa y muestra sus filas. Nunca cambia el mapa.

![Una ejecución completada con los botones Excel, CSV y PDF sobre la cuadrícula de resultados.](shots/es-ES/viewer/06-viewer-results.png)

1. Abra el mapa con el icono del ojo.
2. Haga clic en **Ejecutar**. Responda a las preguntas de **Parámetros de ejecución** si aparecen.
3. Lea las filas. Haga clic en un encabezado para ordenar. Haga doble clic en una fila para ver sus filas sin procesar.
4. Haga clic en **Excel**, **CSV** o **PDF** para exportar.
5. Encontrará el archivo más tarde en **Exportaciones**. Los archivos se conservan 7 días.

Un resultado sigue siendo válido durante 24 horas. **Ejecutar de nuevo** fuerza una ejecución nueva.

---

# Generador de mapas

Use el generador para crear o cambiar un mapa. Solo puede guardar un mapa nuevo con una concesión CREATE en su área de negocio. Solo puede guardar un mapa existente si es suyo o tiene **Puede editar**. Para cambiar el mapa de otra persona, cópielo primero.

![El generador de mapas con el árbol Áreas de negocio, el lienzo de columnas y el panel Propiedades.](shots/es-ES/user/05-builder-overview.png)

1. Haga clic en **Crear Mapa**, o en el icono del lápiz de su propio mapa.
2. Arrastre elementos desde el árbol **Áreas de negocio** a **Columnas**. Todas las columnas deben proceder de una sola área de negocio.
3. Haga clic en una columna para establecer su **Agregación**, su **Dirección de ordenación** o su **Máscara de formato**.
4. Use las pestañas **Condiciones**, **Ordenación**, **Parámetros** y **Campos calculados** si lo necesita.
5. Haga clic en **Guardar** y después en **Ejecutar**. Nada se guarda solo.

---

# Programaciones

Una programación ejecuta un mapa según un horario y guarda el resultado. Solo ve sus propias programaciones.

![La página Programaciones con una programación en pausa y sus iconos de acción.](shots/es-ES/user/38-schedules-list.png)

1. En **Mapas**, haga clic en el icono del calendario del mapa. Para programar el mapa de otra persona, use este icono.
2. Escriba un **Nombre**.
3. Elija la **Frecuencia**, la **Zona horaria** y el **Formato de salida**.
4. Haga clic en **Guardar**.
5. Haga clic en **Ejecutar ahora** para probar. Abra **Historial** para ver los resultados.

| Opción | Significado |
|---|---|
| **Diaria (medianoche)**, **Semanal (domingo, medianoche)**, **Mensual (día 1, medianoche)** | Horarios ya preparados. |
| **Personalizada** | Su propia expresión cron de cinco campos. |
| **Excel (.xlsx)**, **CSV** | Formato del resultado guardado. |

La programación se ejecuta como usted, así que sus concesiones deciden qué datos lee.

---

# Ejecuciones y Exportaciones

**Ejecuciones** muestra sus propias ejecuciones. **Exportaciones** muestra sus propios archivos de exportación. No ve los de otras personas.

![La página Ejecuciones con los filtros Mapa, Estado y Tipo y la lista de ejecuciones.](shots/es-ES/manager/11-runs.png)

1. Haga clic en **Ejecuciones** para ver las ejecuciones en espera, en curso y terminadas.
2. Haga clic en el icono **Abrir** para ver un resultado guardado. Use **Ejecutar de nuevo** para repetirlo.
3. Haga clic en **Cancelar** en una ejecución en cola para detenerla.
4. Haga clic en **Exportaciones** y después en el icono **Descargar** de una fila **Completada**.

---

# Usuarios

La página **Usuarios** es de solo lectura para usted. Puede ver la lista de cuentas y corregir el acceso a los mapas.

![El cuadro Mapas de un usuario, con selectores de nivel de acceso compartido e iconos de propietario y de quitar.](shots/es-ES/manager/12-users-maps-dialog.png)

1. Haga clic en el icono de fila **Mapas que este usuario puede abrir**.
2. Para cambiar un mapa compartido, use la lista de niveles que hay junto a él.
3. Para quitar un mapa compartido, haga clic en la X.
4. Para entregar un mapa, haga clic en el icono de propietario y elija el **Nuevo propietario**.

> **Advertencia:** El nuevo propietario puede cambiar, compartir y eliminar el mapa.

Crear, editar y eliminar usuarios es cosa de los administradores.

---

# Modelado de datos

Las páginas **Áreas de negocio**, **Carpetas**, **Elementos**, **Combinaciones** y **Jerarquías** solo muestran las áreas de negocio en las que tiene una concesión. Su nivel de concesión establece lo que puede hacer.

![La página Carpetas con un área de negocio elegida y sus carpetas.](shots/es-ES/admin/11-folders.png)

| Concesión | Lo que puede hacer |
|---|---|
| VIEW, EXPORT, SCHEDULE | Leer carpetas, elementos, combinaciones y jerarquías. |
| CREATE | Además, agregar carpetas, elementos, combinaciones y jerarquías. |
| EDIT | Además, cambiarlos y actualizar las carpetas desde la base de datos. |
| DELETE | Además, eliminarlos. |

1. Elija un **Área de negocio**. Si la lista está vacía, pida una concesión a un administrador.
2. Para agregar una carpeta: haga clic en **Nueva carpeta**, elija un **Origen de datos**, haga clic en **Descubrir tablas**, escoja una tabla y haga clic en **Guardar**.
3. Para conectar dos carpetas: en **Combinaciones**, haga clic en **Nueva combinación**, haga clic en **Sugerir combinaciones** y después en **Guardar**.

**Nueva área de negocio**, **Eliminar** en un área de negocio y los cambios de concesiones son cosa de los administradores, aunque la pantalla los muestre. El sistema los rechaza.

---

# Funciones personalizadas y Orígenes de datos

Las **Funciones personalizadas** son funciones de la base de datos que pueden llamar los elementos calculados. Tiene todos los derechos sobre ellas. Los **Orígenes de datos** son conexiones guardadas a bases de datos. Solo puede consultarlos y probarlos.

![La página Funciones personalizadas con la lista, Actualizar todo y Nueva función.](shots/es-ES/manager/09-custom-functions.png)

1. En **Funciones personalizadas**, haga clic en **Nueva función**.
2. Elija un **Origen de datos**, escriba parte de un nombre en **Buscar una función** y haga clic en **Buscar**.
3. Haga clic en un resultado para rellenar el cuadro de diálogo y después haga clic en **Guardar**.
4. Use **Actualizar todo** para volver a leer todas las funciones desde Oracle.
5. En **Orígenes de datos**, haga clic en **Probar conexión** para comprobar una conexión.

**Nuevo origen de datos**, **Editar**, **Eliminar** e **Importar** en un origen de datos son cosa de los administradores. El sistema los rechaza.

---

# Configuración

Abra **Configuración** desde la barra lateral o desde el menú de su nombre.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

1. Elija su **Idioma de visualización**, **Apariencia** y **Paleta**.
2. Haga clic en **Guardar**. Sin ello, la elección no le sigue a otros ordenadores.

Para cambiar su contraseña, abra `/change-password`. Necesita al menos 12 caracteres. No hay enlace de restablecimiento. Si la olvida, pida ayuda a un administrador.
