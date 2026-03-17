# 🧠 Contexto del problema

Tenemos una aplicación en **Bubble** donde estamos implementando un **Gantt (DHTMLX Gantt plugin)**.

Actualmente:
- El Gantt está implementado usando múltiples elementos HTML dentro de Bubble
- El código está dividido en:
  - init
  - config
  - CSS
  - funciones
- El editor de Bubble es incómodo para trabajar con código
- Esto hace que el mantenimiento sea difícil y poco escalable

---

# 🎯 Objetivo

Encontrar una forma de:
- mantener el código **limpio y organizado**
- facilitar edición y mantenimiento
- reducir dependencia del editor de Bubble
- evitar montar una app adicional compleja
- minimizar costos (idealmente $0)

---

# ✅ Solución elegida

## ✔️ Usar archivos estáticos externos

Mover toda la lógica del Gantt fuera de Bubble a archivos JS/CSS.

Bubble queda únicamente como:
- contenedor visual
- punto de entrada
- proveedor de contexto/datos

---

# 🏗️ Arquitectura definida

## Bubble

Responsable de:
- renderizar contenedor (`div`)
- pasar variables dinámicas (contexto)
- opcionalmente proveer datos o endpoints

### Ejemplo:

```html
<div id="gantt_here"></div>

<script>
  window.GANTT_CONTEXT = {
    projectId: "...",
    userId: "...",
    readonly: false
  };
</script>

<link rel="stylesheet" href="https://.../gantt-styles.css">
<script src="https://.../gantt-loader.js"></script>
```

7. **dhtmlxgantt.js** y **dhtmlxgantt.css**: Archivos de la versión Pro de dhtmlX Gantt cargados en el repositorio para habilitar las funcionalidades avanzadas.

---

# 🚀 Estado actual del proyecto

## Implementaciones recientes
1. **Integración de dhtmlX Gantt Pro**:
   - Funcionalidades avanzadas habilitadas: auto-scheduling, undo/redo.
   - Archivos Pro (`dhtmlxgantt.js` y `dhtmlxgantt.css`) añadidos al repositorio.

2. **Validación de datos**:
   - Lógica añadida en `data.js` para validar los campos `start_date` y `end_date`.
   - Errores de validación se registran en la consola para facilitar el debugging.

3. **Refactorización de lógica de tooltips**:
   - Lógica de tooltips optimizada en `functions.js` para mejorar la legibilidad y reutilización.

8. **Dependencias FS + sin flecha de progreso** ✅:
   - `drag_progress = false` elimina la flecha de arrastre de progreso en las barras.
   - `drag_links = true` habilita el dibujo nativo de dependencias.
   - `onBeforeLinkAdd` rechaza cualquier tipo que no sea FS (tipo "0").
   - `onAfterLinkAdd/Update/Delete` llaman a `bubble_fn_createLink`, `bubble_fn_updateLink`, `bubble_fn_deleteLink` con payload `{output1: id, output2: source, output3: target, output4: type}`.

7. **Ocultar / mostrar columnas** ✅:
   - Botón flotante "☰ Columnas" abre un dropdown con checkboxes.
   - `text` siempre visible; toggleables: `start_date`, `end_date`, `avance`, `add`.
   - Usa `col.hide = true/false` + `gantt.render()` (enfoque nativo DHTMLX).
   - Estado guardado en localStorage bajo `trakyu_col_visibility`, restaurado antes de `gantt.init()`.

6. **Curva S** ✅:
   - Nuevo archivo `scurve.js` con toda la lógica del overlay.
   - Usa plugin `overlay` de DHTMLX + Chart.js 2.7.3 (CDN en el header de Bubble).
   - Muestra 3 líneas: Planificado, Real, Proyectado (dashed).
   - Botón toggle apilado debajo del botón fullscreen, se pone verde cuando está activo.
   - Barras del Gantt se atenúan al 40% de opacidad cuando el overlay está visible.
   - `initSCurve()` es llamado desde `initGantt()` en init.js tras `gantt.parse()`.

5. **Pantalla completa** ✅:
   - Botón flotante inyectado en `#gantt_here` tras `gantt.init()`.
   - Usa la API nativa del navegador (`requestFullscreen` / `exitFullscreen`).
   - Etiqueta del botón cambia entre "⛶ Pantalla completa" y "✕ Salir".
   - `gantt.render()` se llama en `fullscreenchange` para refluir el layout.

4. **Columnas dinámicas con resize** ✅:
   - `gantt.config.keep_grid_width = false` para permitir resize independiente por columna.
   - `resize: true` añadido a todas las columnas (excepto el botón `add`).
   - Anchos guardados en `localStorage` bajo la clave `trakyu_col_widths` al soltar el resize.
   - Anchos restaurados automáticamente en cada carga vía `applyColWidths()` antes de `gantt.init()`.

---