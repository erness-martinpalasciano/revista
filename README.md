# Revista Científica · ConCiencia

Sección de Revista Científica del Club de Ciencias ConCiencia. HTML + CSS + JavaScript; los artículos se leen **directamente desde PDF**.

## Cómo ejecutarla (importante)
Los PDF se leen con PDF.js, que necesita un servidor local (no funciona abriendo `index.html` con doble clic).
- **Visual Studio Code:** instalá la extensión *Live Server*, clic derecho en `index.html` → *Open with Live Server*.
- **Alternativa:** en esta carpeta ejecutá `python3 -m http.server 8000` y entrá a `http://localhost:8000`.
- **Publicar:** subí la carpeta completa a Netlify (o cualquier hosting estático).

## Estructura
```
revista/
├── index.html
├── css/styles.css          ← colores y tipografías: variables de :root
├── js/
│   ├── articles.js         ← ÚNICO lugar donde se registran los artículos
│   ├── pdf-source.js       ← lee el PDF (páginas, proporciones) con PDF.js
│   ├── flipbook.js         ← revista 3D: hoja con curvatura, sombras y sonido
│   ├── zoom.js             ← lectura ampliada (solo lectura)
│   ├── search.js           ← buscador por autor, tema/título y fecha
│   ├── assistant.js        ← Marie Curie: preguntas frecuentes y mensajes
│   └── main.js             ← rutas, menú, lector
├── assets/
│   ├── articles/article-00.pdf   ← REEMPLAZALO por el PDF real
│   ├── images/             ← article-00-cover.jpg, marie.png
│   ├── sounds/page-flip-1…4.wav  ← reemplazables (se elige uno al azar)
│   └── vendor/pdfjs/       ← PDF.js (local, no usa internet)
└── README.md
```

## Reemplazar el PDF del artículo 00
Copiá tu PDF a `assets/articles/article-00.pdf` (mismo nombre) y listo.

## Agregar un artículo nuevo (3 pasos)
1. Poné el PDF en `assets/articles/` (ej.: `article-01.pdf`).
2. Poné la portada en `assets/images/` (ej.: `article-01-cover.jpg`; si no la ponés, se genera con la página 1 del PDF).
3. En `js/articles.js` copiá el objeto del arreglo `RAW` y cambiá los datos:
```js
{ id: '01', title: 'Título', authors: ['Nombre Apellido'], date: '15/11/2026',
  category: 'Química', cover: 'assets/images/article-01-cover.jpg', pdf: 'assets/articles/article-01.pdf' }
```
La cantidad de páginas y sus proporciones (A4 vertical, horizontal, mezcladas) se detectan solas; nunca se estiran ni recortan (si una página difiere de la portada, se centra con márgenes). Galería, buscador, autores y lector se arman solos. `id` es también el número de la miniatura.

## Marie Curie
- Preguntas frecuentes y respuestas: copiadas del sitio original (`FAQ` en `assistant.js`).
- **Mensajes espontáneos:** pegá los textos originales en el arreglo `MESSAGES` de `assistant.js`. Aparecen en la galería (nunca durante la lectura). Frecuencia: `FIRST_DELAY`, `EVERY`, `VISIBLE`.

## Lectura ampliada
Doble clic (o doble toque) en el centro de una página, o botón «Ampliar». Solo lectura, con scroll; se sale con el botón o Escape y vuelve a la misma página.

## Tecnologías
HTML5, CSS3 (3D), JavaScript vanilla y PDF.js (Mozilla, licencia Apache 2.0, en `assets/vendor/pdfjs/`). El efecto de volteo es propio: la hoja se divide en tiras que se curvan, con sombras dinámicas.
