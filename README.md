# Seguimiento Legislativo — Frontend

Frontend estático (HTML/CSS/JS puro, sin build) para consultar proyectos de
ley por número de boletín, usando el backend de Google Apps Script como API.

## Estructura

```
index.html   → estructura de la página
style.css    → estilos
app.js       → lógica: fetch al backend, render, historial, modal de votos
config.js    → único archivo que debes editar (URL del backend)
```

## Puesta en marcha

1. Abre `config.js` y reemplaza `BASE_URL` por la URL de tu Web App de Apps
   Script (la que termina en `/exec`):

   ```js
   var CONFIG = {
     BASE_URL: 'https://script.google.com/macros/s/AKfycb.../exec'
   };
   ```

2. Verifica que la implementación esté publicada con acceso **"Cualquier
   persona"** (Implementar → Gestionar implementaciones → Editar → Quién
   tiene acceso). Si no, el navegador recibirá un error de autenticación al
   hacer `fetch`.

3. Sube estos 4 archivos a un repositorio de GitHub y activa **GitHub
   Pages** (Settings → Pages → Deploy from branch → `main` / `root`).
   La página quedará en `https://tu-usuario.github.io/tu-repo/`.

   También puedes probarla localmente abriendo `index.html` en el
   navegador — no necesita servidor.

## Cómo funciona

- Al buscar un boletín, la página llama en paralelo a
  `?accion=proyecto&boletin=...` y `?accion=votaciones&boletin=...`.
- Cada fila de votación es clicable y abre un modal que llama a
  `?accion=votacion&votacion_id=...` para traer el detalle voto por voto,
  con filtro por A favor / En contra / Abstención.
- Las últimas búsquedas quedan guardadas en el navegador (localStorage)
  como chips debajo del buscador.
- El boletín buscado queda en la URL (`?boletin=18216-05`), así que puedes
  compartir el enlace directo a un proyecto.

## Notas

- El backend de Apps Script normalmente no requiere configuración CORS
  adicional para peticiones `GET` simples desde el navegador, pero si ves
  errores de CORS en la consola, revisa que la implementación sea de tipo
  "Aplicación web" (no "API ejecutable") y que el acceso esté en "Cualquier
  persona".
- Si cambias el nombre de la acción `sincronizar` u otras rutas en el
  backend, no afecta a este frontend: solo usa `proyecto`, `votaciones` y
  `votacion`.
- Pendiente si te interesa: una vista de listado (`mensajes`/`mociones`
  por año) — el backend ya expone esas acciones, solo falta la pantalla.
