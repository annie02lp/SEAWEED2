# Seaweed — Especificación viva

## Qué hace
Seaweed es un videojuego web retro 16-bit para limpiar una zona de anidación de tortugas marinas. El jugador introduce un apodo, controla un bote recolector con teclado o botones táctiles, atrapa basura y sargazo, y conserva 7 vidas.

## Datos
- `game_scores`: `id`, `nickname`, `score`, `collected_count` y `played_at` interno.
- El endpoint público de impacto solo devuelve apodo, puntuación y cantidad recolectada; nunca devuelve `played_at`.
- `total_games` es el número de partidas guardadas y `total_cleanup_points` es la suma de las puntuaciones.

## Flujos clave
1. Menú principal centrado: apodo + JUGAR, con modales compactos para Impacto Global e Instrucciones.
2. Gameplay unificado en el viewport: HUD integrado en el marco y controles A/D, flechas o táctiles.
3. Cada objeto perdido resta una vida; al llegar a cero se guarda la partida.
4. Game Over aparece como overlay dentro del mismo marco, con puntuación, tip ecológico, volver a jugar y tabla global.
5. El modal Impacto Global actualiza métricas y Top 10 sin scroll de página ni fechas públicas.
6. El menú muestra la firma de autoría y abre un modal de acción local con enlaces externos a tres organizaciones de Cancún.
7. El HUD muestra un combo de capturas seguidas, que vuelve a cero cuando se pierde un objeto.

## Auth y roles
No hay autenticación ni roles. El apodo es anónimo y solo identifica la puntuación pública.