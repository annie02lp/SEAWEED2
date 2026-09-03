# Seaweed — Especificación viva

## Qué hace
Seaweed es un videojuego web retro 16-bit para limpiar una zona de anidación de tortugas marinas. El jugador introduce un apodo, controla un bote recolector con teclado o botones táctiles, atrapa basura y sargazo, y conserva 7 vidas.

## Datos
- `game_scores`: `id`, `nickname`, `score`, `collected_count` y `played_at` interno.
- El endpoint público de impacto solo devuelve apodo, puntuación y cantidad recolectada; nunca devuelve `played_at`.
- `total_games` es el número de partidas guardadas y `total_cleanup_points` es la suma de las puntuaciones.

## Flujos clave
1. Apodo corto sin registro → iniciar partida.
2. Atrapar objetos que caen con A/D, flechas o controles táctiles.
3. Cada objeto perdido resta una vida; al llegar a cero se guarda la partida.
4. Game Over muestra puntuación, tip ecológico y estado de guardado.
5. El panel Impacto Global actualiza métricas y Top 10.

## Auth y roles
No hay autenticación ni roles. El apodo es anónimo y solo identifica la puntuación pública.