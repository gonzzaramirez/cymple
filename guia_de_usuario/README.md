# 📚 Guía de Usuario y Exportación a PDF

Bienvenido a la documentación y guías de usuario del sistema Cymple.
En esta carpeta (`guia_de_usuario`) encontrarás todos los manuales redactados en lenguaje humano, amigable y simple, divididos en dos grandes perfiles:

1. **/profesional**: Guías pensadas para los médicos y especialistas que usan la plataforma.
2. **/centro**: Guías orientadas a la administración, directores y secretaría del centro médico.

## ¿Cómo generar un PDF hermoso a partir de estos archivos?

Para entregar esta guía a tus clientes o usuarios finales, lo ideal es compilar estos archivos Markdown (`.md`) en un documento PDF con diseño profesional. Aquí te detallamos las mejores herramientas modernas para hacerlo:

### Opción 1: Markdown PDF (Extensión de VSCode / Cursor) - *La más rápida*
Si usas Cursor o VSCode como editor, esta es la forma más directa y veloz.
1. Instala la extensión **Markdown PDF** (creada por yzane).
2. Para aplicar los estilos visuales propios de Cymple (fuentes de Apple, colores sobrios), puedes crear un archivo `style.css` en esta misma carpeta con el siguiente contenido base:
   ```css
   body {
     font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
     color: #1d1d1f;
     line-height: 1.6;
   }
   h1, h2, h3 {
     font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
     color: #0a0a0a;
     border-bottom: 1px solid #e5e5e5;
     padding-bottom: 0.3em;
   }
   a { color: #0071e3; text-decoration: none; }
   ```
3. En la configuración de la extensión en el editor, añade la ruta local de tu archivo `style.css`.
4. Abre cualquier archivo `.md`, haz clic derecho sobre el texto y selecciona **"Markdown PDF: Export (pdf)"**.

### Opción 2: Typst - *El estándar moderno y elegante*
**Typst** (typst.app) es una alternativa moderna, rapidísima y mucho más amigable a LaTeX. Te permite crear PDFs hermosos y con diseño de revista o libro editorial.
- Puedes copiar el texto de estos archivos Markdowns en un documento nuevo de Typst y aplicarle una plantilla (template) predefinida de manual o libro. Genera PDFs instantáneamente y con una calidad tipográfica perfecta.

### Opción 3: Mintlify o VitePress - *Sitio Web + PDF*
Si en el futuro Cymple crece y deseas tener una página web pública tipo "Centro de Ayuda" (ej. `ayuda.cymple.com`):
1. Usa **VitePress** (basado en Vue) o **Mintlify**.
2. Ambos motores toman estos mismos archivos `.md` y generan un sitio web de documentación hermoso, interactivo y con modo oscuro automático.
3. Usando plugins de la comunidad (como `vitepress-export-pdf`), puedes generar un PDF completo y unificado de todo el sitio web con un solo comando en la terminal.

### Opción 4: Marp - *Formato Presentación / Diapositivas*
Si prefieres que la guía parezca un tutorial paso a paso visual (tipo diapositivas en PDF), usa **Marp** (marp.app).
- Solo debes agregar `marp: true` al inicio de tus archivos `.md` y la extensión de Marp para VSCode/Cursor te permitirá exportar un PDF apaisado, ideal para leer en pantallas de computadora de forma más didáctica.
