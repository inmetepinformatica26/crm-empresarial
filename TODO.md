# TODO - Modal de creación de Tareas

## Convertir la creación de tareas en un modal con asignado a y vencimiento

- [x] 1. `public/index.html`: Añadir modal `taskModal` con campos Título, Descripción, Asignado a, Prioridad y Vencimiento
- [x] 2. `public/js/app.js`: Modificar `addTask(projectId)` para abrir el modal en lugar de `prompt()`
- [x] 3. `public/js/app.js`: Añadir `addTask` que llena el select de usuarios asignables (`getAssignableUsers`)
- [x] 4. `public/js/app.js`: Añadir `handleTaskSave()` que crea la tarea con todos los campos
- [x] 5. `public/js/app.js`: Registrar el submit de `taskForm` en `DOMContentLoaded`
- [x] 6. Probar localmente: servidor sirve `taskModal`, `taskAssigned`, `taskDueDate`, `handleTaskSave`; sintaxis JS validada con `node --check`
- [ ] 7. Commit y push a GitHub para que Render haga el deploy

## Notas
- El backend `POST /api/projects/:id/tasks` ya acepta `title`, `description`, `assigned_to`, `priority` y `due_date`
- `API.getAssignableUsers()` y `API.createTask()` ya existen
</content>
