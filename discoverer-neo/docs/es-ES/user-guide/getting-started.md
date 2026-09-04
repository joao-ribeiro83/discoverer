# Primeros pasos con Discoverer Neo

Aprenda a iniciar sesión y a navegar por la interfaz de Discoverer Neo.

## Acceso a Discoverer Neo

1. Abra su navegador y vaya a la URL de Discoverer Neo (p. ej., `http://localhost:5173` para desarrollo)
2. Debería ver la pantalla de inicio de sesión

## Inicio de sesión

**Pantalla de inicio de sesión:**
- **Correo electrónico:** su dirección de correo electrónico
- **Contraseña:** su contraseña (proporcionada por su administrador)

Introduzca sus credenciales y haga clic en **Iniciar sesión**.

**¿Es la primera vez?** Póngase en contacto con su administrador para crear una cuenta.

## Primer inicio de sesión con una contraseña temporal

Si su cuenta se trasladó desde Oracle Discoverer, su administrador le dará una
**contraseña temporal**. Es una cadena aleatoria de 16 caracteres, por ejemplo
`ufNnRksjgR7U%M6X`.

1. Inicie sesión con su dirección de correo y la contraseña temporal.
2. Irá directamente a **Cambiar la contraseña**: no puede omitir este paso. Hasta
   que elija una contraseña, el resto de la aplicación no está disponible.
3. Introduzca de nuevo la contraseña temporal y después la nueva dos veces.
4. Llegará al panel y la contraseña temporal dejará de funcionar de inmediato.

Su nueva contraseña debe tener **al menos 12 caracteres** y ser distinta de la
temporal.

> **Consejo:** la contraseña temporal evita deliberadamente los caracteres fáciles
> de confundir: sin `O` mayúscula ni cero, sin `l` minúscula ni uno. Si un
> carácter le parece ambiguo, no es ninguno de esos.

Si escribe mal la contraseña temporal, la pantalla se lo indica y no se cambia
nada; pida a su administrador que la restablezca si la ha perdido.

## Interfaz principal

Tras iniciar sesión, verá el panel principal con las siguientes secciones:

### Navegación

**Barra lateral izquierda:**
- **Panel** — Resumen y acciones rápidas
- **Áreas de negocio** — Colecciones de datos organizadas
- **Mapas** — Todos los mapas a los que puede acceder: los suyos, los
  compartidos con usted, o (según sus permisos) toda la colección
- **Configuración** — Personalice las preferencias de idioma y tema
- **Administración** (si tiene privilegios de administrador) — Gestión del sistema

### Panel

El panel muestra:
- **Mapas recientes** — Los mapas que ha visto o ejecutado recientemente
- **Estadísticas rápidas** — Número de mapas, ejecuciones y elementos compartidos
- **Trabajos programados** — Ejecuciones programadas activas y próximas

## Exploración de áreas de negocio

Un **área de negocio** es una agrupación lógica de datos y consultas relacionados.

1. Haga clic en **Áreas de negocio** en la barra lateral
2. Verá una lista de las áreas a las que tiene acceso
3. Haga clic en un área de negocio para explorar su contenido:
   - **Carpetas** — Tablas/vistas disponibles en esta área
   - **Elementos** — Columnas/campos dentro de las carpetas
   - **Combinaciones** — Relaciones entre carpetas
   - **Mapas existentes** — Consultas ya creadas para esta área

## Sus mapas

### Ver sus mapas

1. Haga clic en **Mapas** en la barra lateral
2. Tres pestañas le permiten cambiar el alcance:
   - **Mío** — Mapas que ha creado
   - **Compartido conmigo** — Mapas que otros han compartido explícitamente con usted
   - **Todos** — Todos los mapas que puede ver, incluyendo los migrados
     de Discoverer que nadie ha compartido ni reasignado aún
3. Busque por nombre, filtre por área de negocio y ordene por nombre o por
   la última actualización de un mapa
4. Haga clic en **Crear mapa** para empezar uno nuevo

### Crear un mapa nuevo

Consulte [Creación de mapas](building-maps.md).

### Ver los detalles de un mapa

Haga clic en cualquier mapa para ver:
- La definición del mapa (elementos seleccionados, filtros, parámetros)
- El historial de ejecución
- Los permisos de uso compartido

## Navegación por la ayuda

- **Pase el cursor sobre los iconos** para ver descripciones emergentes
- **Busque los iconos «?»** para obtener ayuda específica de cada campo
- **Consulte los mensajes de error en línea** para obtener información sobre la validación

## ¿Qué sigue?

- **[Configuración](settings.md)** — Personalice el idioma y el tema
- **[Creación de mapas](building-maps.md)** — Cree su primera consulta
- **[Ejecución de mapas](executing-maps.md)** — Ejecute mapas y consulte los resultados
- **[Exportación de datos](exporting-data.md)** — Descargue los resultados como Excel o CSV
- **[Programación de mapas](scheduling.md)** — Automatice la generación de informes

---

**Consulte también:** [Guía del usuario](../user-guide/), [Referencia de la API](../../api/endpoints.md)
