# Seaweed — Especificación viva

## Qué hace
Seaweed es un videojuego web retro 16-bit para limpiar una zona de anidación de tortugas marinas. El jugador introduce un apodo, controla un bote recolector con teclado o botones táctiles, atrapa basura y sargazo, y conserva 7 vidas.

## Datos
- La aplicación es autónoma para todos los datos de juego y no realiza llamadas a FastAPI, MongoDB ni ninguna API de juego. El modal de opiniones carga únicamente el Padlet público solicitado.
- `localStorage["seaweed.local.game-state.v1"]` guarda apodo, vidas, puntuación y estado de la partida.
- `localStorage["seaweed.local.impact.v1"]` guarda partidas totales, puntos acumulados y Top 10 de este navegador.
- El ranking local solo contiene `id`, apodo, puntuación y cantidad recolectada; nunca fechas u horas.

## Flujos clave
1. Menú principal centrado: apodo + JUGAR, con modales compactos para Impacto Global e Instrucciones.
2. Gameplay unificado en el viewport: HUD integrado en el marco y controles A/D, flechas o táctiles.
3. Cada objeto perdido resta una vida; apodo, vidas, puntuación y estado se persisten automáticamente en localStorage.
4. Game Over aparece como overlay dentro del mismo marco, con puntuación, tip ecológico, volver a jugar y tabla global.
5. El modal Impacto Local actualiza métricas y Top 10 acumulados en el navegador, sin fechas públicas.
6. El menú muestra la firma de autoría y abre un modal de acción local con enlaces externos a tres organizaciones de Cancún.
7. El HUD muestra un combo de capturas seguidas, que vuelve a cero cuando se pierde un objeto.
8. El menú abre un modal amplio “Deja tu opinión” con el Padlet público incrustado y un enlace de respaldo para abrirlo en una pestaña nueva.
9. Game Over ofrece el mismo acceso a opiniones y el modal avisa que toda publicación será visible para la comunidad.
10. El menú destaca “Opiniones públicas” sin mostrar una cifra: Padlet no ofrece conteo público oficial sin API key/servidor, y la app no inventa datos ni expone credenciales.

## Auth y roles
No hay autenticación ni roles. El apodo es anónimo y solo identifica la puntuación pública.