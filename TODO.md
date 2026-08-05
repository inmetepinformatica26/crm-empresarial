# TODO - Verificación: la base de datos no debe reiniciarse al subir a Render

## Verificar que PostgreSQL persiste en deploys de Render

- [x] 1. Analizar `database.js`: usa `process.env.DATABASE_URL` para elegir PostgreSQL
- [x] 2. Confirmar que `createTables()` usa `CREATE TABLE IF NOT EXISTS` (no reinicia datos)
- [x] 3. Confirmar que `seedDefaultAdmin()` es idempotente (solo crea admin si no hay usuarios)
## Cambios realizados en el código
- [x] 4. `database.js`: Log explícito del motor usado al arrancar (PostgreSQL / SQLite) - ya existía
- [x] 5. `database.js`: Guarda de seguridad - si corre en Render sin DATABASE_URL, lanzar error y detener
- [x] 6. `server.js`: Endpoint `GET /api/health` que reporta motor y estado (sin token)
- [x] 7. Exportada `USE_POSTGRES` desde database.js para uso en health check
- [x] 8. Probado `/api/health` localmente (SQLite) -> responde 200 con engine correcto
- [x] 9. Probada la guarda de seguridad: RENDER sin DATABASE_URL lanza error y detiene arranque
- [x] 10. Corregido bug PUT /api/settings (500): `run()` agregaba `RETURNING id` a tablas sin columna `id`
- [x] 11. Corregido bug DELETE usuario (500): limpiar dependencias (activity_log, clients, projects, tasks) antes de borrar
- [ ] 12. Guía de verificación en Render Dashboard (GPS)

## Verificación en producción (Render)

- [ ] Revisar que el proyecto tiene un servicio **PostgreSQL administrado** conectado
- [ ] Revisar que la variable de entorno `DATABASE_URL` apunta a la **Internal Database URL**
- [ ] Hacer un redeploy y revisar logs: debe aparecer "Base de datos PostgreSQL inicializada correctamente"
- [ ] Llamar `https://<tu-app>.onrender.com/api/health` y verificar `{ engine: "postgres", status: "ok" }`

