# Su rol en una página

Usted es **administrador**. Puede usar todas las páginas. Un **mapa** es un informe (en Oracle Discoverer, una hoja de trabajo). Un **área de negocio** es un grupo de datos relacionados.

| Puede | No puede |
|---|---|
| Abrir, cambiar, compartir, copiar y eliminar todos los mapas | Eliminar o desactivar su propia cuenta |
| Crear mapas en cualquier lugar, sin necesidad de concesión | Descargar la exportación de otro usuario |
| Ver el SQL y el plan de un mapa | Ver las programaciones de otros usuarios en la lista |
| Ver las ejecuciones de todos los usuarios | |
| Configurar áreas de negocio, carpetas, elementos, combinaciones, jerarquías, funciones y orígenes de datos | |
| Gestionar usuarios, concesiones y directivas de seguridad | |
| Leer el registro de auditoría y ejecutar migraciones | |

**Iniciar sesión:** escriba el **Correo electrónico** y la **Contraseña** y haga clic en **Iniciar sesión**. Para salir, use **Cerrar sesión** en el menú de su nombre. En **Configuración** (idioma, tema, paleta) hay que pulsar **Guardar** para que los cambios permanezcan.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

---

# Panel y Mapas

El **Panel** cuenta los mapas, las ejecuciones y sus programaciones. **Mapas** muestra todos los mapas del sistema.

![La lista de Mapas, pestaña Todos, con todos los iconos de fila y la sección Libros de trabajo encima.](shots/es-ES/admin/02-maps-all.png)

1. Abra **Mapas**. Use las pestañas **Míos**, **Compartidos conmigo** y **Todos**.
2. Busque un mapa con el cuadro de búsqueda o con el filtro **Área de negocio**.
3. Haga clic en el icono del ojo para ejecutarlo y en el del lápiz para cambiarlo.
4. Haga clic en el icono Compartir para dar acceso.
5. Haga clic en el icono de la papelera para eliminarlo (solo un administrador puede restaurarlo).

| Opción | Significado |
|---|---|
| **Puede ver** | Solo abrir y ejecutar. |
| **Puede exportar** | Además, exportar y programar. |
| **Puede editar** | Además, cambiar el mapa. No puede volver a compartirlo. |
| Icono Copiar | Su propia copia privada. |

---

# Generador y visor de mapas

El generador hace un mapa. El visor lo ejecuta.

![Los resultados de una ejecución con los botones SQL y Plan junto a los botones Excel, CSV y PDF.](shots/es-ES/admin/03-viewer-results.png)

1. Haga clic en **Crear Mapa**.
2. Arrastre elementos desde el árbol **Áreas de negocio** al lienzo. El primer elemento fija el área de negocio.
3. Haga clic en una columna para establecer la **Agregación**, la ordenación o el formato.
4. Si lo necesita, agregue **Condiciones**, **Parámetros** o **Campos calculados** en las pestañas de la derecha.
5. Haga clic en **Guardar** y después en **Ejecutar**.
6. Exporte con **Excel**, **CSV** o **PDF**. También verá **SQL** y **Plan**.

| Opción | Significado |
|---|---|
| **Público** (Propiedades) | Cualquier usuario con la sesión iniciada puede abrirlo y exportarlo. |
| **Agregación** | NONE, SUM, COUNT, AVG, MIN, MAX. |
| **Ejecutar de nuevo** (visor) | Nueva ejecución, sin usar el resultado almacenado. |
| **PDF** | Elija el papel (A4, A3, Carta) y la orientación. |

---

# Ejecuciones, Exportaciones y Programaciones

Una **ejecución** es una vez que se ejecuta un mapa (se conserva 24 horas). Una **exportación** es un archivo creado a partir de una ejecución (se conserva 7 días). Una **programación** ejecuta un mapa por sí sola.

![La página Ejecuciones mostrando las ejecuciones de todos los usuarios.](shots/es-ES/admin/04-runs-every-user.png)

1. En **Ejecuciones**, marque **Mostrar ejecuciones de todos los usuarios** para ver las de todos.
2. Haga clic en **Abrir** para ver un resultado, o en **XLSX**, **CSV**, **PDF** para exportarlo.
3. En **Exportaciones**, haga clic en el icono Descargar. Solo ve sus propios archivos.
4. En **Programaciones**, haga clic en **Nueva programación**. Elija el mapa, la **Frecuencia**, la **Zona horaria** y el **Formato de salida**. Haga clic en **Guardar**.
5. Use **Historial** para abrir o exportar resultados anteriores.

| Opción | Significado |
|---|---|
| **Frecuencia** | **Diaria (medianoche)**, **Semanal (domingo, medianoche)**, **Mensual (día 1, medianoche)**, **Personalizada** (cron). |
| **Formato de salida** | **Excel (.xlsx)** o **CSV**. |
| **Ejecutar ahora** | Ejecuta una programación de inmediato. |

---

# Áreas de negocio y Concesiones

Un área de negocio agrupa carpetas. Una **concesión** da a una persona acceso a sus datos. Una concesión nunca hace visible un mapa.

![El cuadro Administrar concesiones con la lista Permiso abierta.](shots/es-ES/admin/09-business-areas-grants-permission.png)

1. Abra **Áreas de negocio**. Haga clic en **Nueva área de negocio**, escriba un **Nombre** y haga clic en **Guardar**.
2. Haga clic en el icono **Administrar concesiones**.
3. Marque a las personas. Elija el **Permiso**. Haga clic en **Agregar**.
4. Haga clic en **Revocar** para retirar una concesión.

| Nivel | Significado |
|---|---|
| VIEW | Leer datos y ejecutar mapas compartidos. |
| EXPORT, SCHEDULE | Igual que VIEW. Los derechos proceden del recurso compartido del mapa. |
| CREATE | Además, crear mapas, carpetas, elementos, combinaciones y jerarquías. |
| EDIT | Además, cambiar el área y sus objetos. |
| DELETE | Además, eliminar esos objetos. |

---

# Carpetas, Elementos, Combinaciones, Jerarquías

Una **carpeta** es una tabla o una vista. Un **elemento** es una columna. Una **combinación** conecta dos carpetas. Una **jerarquía** es una lista de desglose.

![El cuadro Nueva carpeta tras Descubrir tablas, con la lista de tablas encontradas.](shots/es-ES/admin/14-folders-discovered.png)

1. Elija un área de negocio en **Carpetas**. Haga clic en **Nueva carpeta**.
2. Elija el **Origen de datos**, haga clic en **Descubrir tablas** y haga clic en una tabla.
3. Marque las columnas que se crearán como elementos. Haga clic en **Guardar**.
4. En **Combinaciones**, haga clic en **Nueva combinación**. Elija dos carpetas, haga clic en **Sugerir combinaciones** y elija un **Tipo de combinación**. Haga clic en **Guardar**.
5. En **Jerarquías**, haga clic en **Nueva jerarquía** y agregue los niveles de arriba abajo. Haga clic en **Guardar**.
6. Use **Actualizar todo** para volver a leer las tablas cuando la base de datos haya cambiado.

| Opción | Significado |
|---|---|
| **Tipo de carpeta** | TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY. |
| **Tipo de combinación** | INNER, LEFT, RIGHT. |
| **Tipo de elemento** | Base de datos (CO), Creado (CI), Calculado (CU), Combinación (JI), Jerarquía (HI), Agregación (AG), Función (FU). |

---

# Funciones personalizadas y Orígenes de datos

Un **origen de datos** es una conexión guardada a una base de datos. Una **función personalizada** es una función de Oracle que pueden llamar los elementos calculados.

![La página Orígenes de datos con una tabla de conexiones y cinco iconos de fila.](shots/es-ES/admin/30-data-sources.png)

1. En **Orígenes de datos**, haga clic en **Nuevo origen de datos**. Rellene **Nombre**, **Tipo de conexión**, **Host**, **Puerto**, **Nombre de usuario** y **Contraseña**. Haga clic en **Guardar**.
2. Haga clic en **Probar conexión**.
3. Haga clic en **Importar tablas** para crear muchas carpetas a la vez.
4. En **Funciones personalizadas**, haga clic en **Nueva función**. Elija el origen de datos, busque en Oracle y haga clic en un resultado. Haga clic en **Guardar**.

| Opción | Significado |
|---|---|
| **Tipo de conexión** | **Oracle** o **PostgreSQL**. |
| **Tipo de función** | SQL, PLSQL, PACKAGE. |
| **Actualizar todo** | Vuelve a leer las funciones desde Oracle. |

---

# Usuarios

Agregue personas, establezca roles, desactive cuentas y traspase mapas a otros.

![La página Usuarios con los botones Archivo de credenciales y Nuevo usuario y los iconos de fila.](shots/es-ES/admin/35-users.png)

1. Haga clic en **Nuevo usuario**. Escriba el **Nombre**, el **Correo electrónico** y la **Contraseña** (8 o más caracteres), y elija el **Rol**. Haga clic en **Guardar**.
2. Haga clic en **Archivo de credenciales** para entregar contraseñas temporales a las cuentas migradas. Entregue a cada persona solo su línea.
3. Haga clic en el icono **Mapas que este usuario puede abrir** para ver lo que ve esa persona. Cambie un nivel de acceso compartido o entregue un mapa a un **Nuevo propietario**.
4. Para detener el acceso, haga clic en **Desactivar**. Haga clic en **Activar** para deshacerlo.

| Opción | Significado |
|---|---|
| ADMIN | Todo. |
| MANAGER | Ve, ejecuta, exporta, programa y comparte todos los mapas. Modela datos solo donde tiene concesión. |
| USER | Mapas propios, públicos y compartidos. |
| VIEWER | Igual que USER, pero no puede copiar mapas. |
| **Desactivar** | Conserva la cuenta. Es reversible. |
| **Eliminar** | Elimina la cuenta para siempre. No se puede deshacer. |

---

# Directivas de seguridad y Registro de auditoría

Una **directiva** filtra las filas que ven las personas. El **Registro de auditoría** muestra quién hizo qué.

![El cuadro Nueva directiva con un nombre, una descripción y una regla.](shots/es-ES/admin/44-security-new-dialog.png)

1. En **Seguridad**, haga clic en **Nueva directiva**. Escriba un **Nombre**.
2. Elija **Se aplica a** (**Área de negocio** o **Carpeta**) y el destino.
3. Escriba el **Predicado SQL**, por ejemplo `{alias}.REGION = 'NORTH'`. Haga clic en **Validar**. Haga clic en **Guardar**.
4. Haga clic en el icono **Asignaciones**. Elija **Usuario** o **Rol**. Haga clic en **Asignar**.
5. En **Registro de auditoría**, filtre por **Usuario**, **Acción** o **Desde**/**Hasta**. Haga clic en un icono **Ver detalles** para ver la entrada completa.

> **Advertencia:** Una carpeta sin directiva sigue un ajuste de la instalación. En modo **cerrado** (el predeterminado) nadie ve sus filas, usted incluido. En modo **abierto** todos los que tienen una concesión ven todas las filas.

---

# Migración

La **Migración** importa un EUL de Oracle Discoverer (sus áreas de negocio, carpetas, libros de trabajo y usuarios almacenados). Escribe mucho en esta base de datos.

![La página Migración con la tarjeta de origen, sus botones y el texto de ayuda.](shots/es-ES/admin/50-migration.png)

1. Registre la conexión de Oracle en **Orígenes de datos**.
2. En **Migración**, elija el **Origen de datos Oracle**. Haga clic en **Detectar versión** y después en **Analizar**.
3. Deje marcada **Simulación**. Haga clic en **Ejecutar simulación**. Lea el informe y el registro.
4. Desmarque **Simulación** y haga clic en **Ejecutar migración**.
5. En **Usuarios**, haga clic en **Archivo de credenciales** para que las personas migradas puedan iniciar sesión.
6. Mueva los mapas de "Migrated Workbooks" al área de negocio correcta.

| Opción | Significado |
|---|---|
| **Reimportar mapas** | Reconstruye solo los mapas. Reemplaza todos los mapas de "Migrated Workbooks". Se pierden las ediciones, programaciones y recursos compartidos de esos mapas. |
| **Reimportar todo** | Reescribe lo que difiere. No elimina nada. Conserva los identificadores, las programaciones y los recursos compartidos. |
| **Compilar campos calculados** | Úselo si un mapa dice que un campo "no se ha compilado". |

> **Advertencia:** Haga siempre primero una simulación.
