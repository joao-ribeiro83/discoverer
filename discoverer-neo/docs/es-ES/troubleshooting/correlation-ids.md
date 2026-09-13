# Cómo informar un error: el id de correlación

Un error real (un panel **rojo** — véase [Ejecución de mapas](../user-guide/executing-maps.md);
un panel ámbar de rechazo es distinto, véase [Por qué se rechazó una hoja de trabajo](refusals.md))
ahora incluye un `correlationId` junto con su mensaje:

```json
{
  "error": "The query could not be completed.",
  "statusCode": 500,
  "kind": "QUERY",
  "correlationId": "8f14e45f-ceea-467e-a4d6-f8c9d1e2b3a4"
}
```

El mensaje en pantalla es deliberadamente genérico — para un fallo de ejecución de un mapa, nunca contiene el texto de error propio de la base de datos (un mensaje `ORA-` de Oracle puede describir detalles internos del esquema o de los datos que no deberían llegar a todos los usuarios que pueden ejecutar un mapa). El detalle completo — el error real del controlador, el SQL, la pila de llamadas — se guarda en el servidor, etiquetado con el mismo id.

**Al informar un error, incluya el `correlationId`.** Un administrador puede localizar la línea correspondiente en los registros del servidor (o, en una ejecución de mapa asíncrona, el propio id del trabajo actúa también como id de correlación) sin necesidad de que se le repita el texto original.

`kind` agrupa el error según lo que falló (`CONFIG`, `CONNECT`, `TIMEOUT`, `QUERY`, `CANCELLED`, `FORBIDDEN`) — útil para la clasificación del soporte técnico antes de abrir ningún registro.
