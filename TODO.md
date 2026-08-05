# TODO - Exportar Proyectos a Excel

## Implementación en frontend con SheetJS (sin tocar backend)

- [x] 1. Analizar estructura: `routes/projects.js`, `public/js/app.js`, `public/index.html`
- [x] 2. `public/index.html`: Añadir CDN de SheetJS en el `<head>`
- [x] 3. `public/index.html`: Añadir botón "Exportar Excel" en el `section-header` de proyectos
- [x] 4. `public/js/app.js`: Añadir función `exportProjectsToExcel()` usando `projectsCache`
- [x] 5. Probar localmente: servidor sirve CDN de SheetJS, botón "Exportar Excel" y función `exportProjectsToExcel()`; sintaxis JS validada con `node --check`
- [ ] 6. Commit y push a GitHub para que Render haga el deploy
- [ ] 7. Verificar en producción

## Notas
- `projectsCache` contiene los proyectos ya cargados/filtrados en `loadProjects()`
- Se traducen códigos de estado y prioridad a etiquetas en español
- El archivo se descarga como `proyectos_AAAAMMDD.xlsx`
