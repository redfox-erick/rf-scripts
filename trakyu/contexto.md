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