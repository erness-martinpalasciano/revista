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
│   ├── curl.js             ← la hoja de papel flexible (WebGL): pliegue diagonal, curvatura, sombras
│   ├── flipbook.js         ← revista: páginas, arrastre, clic, teclado, sonido
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

## Efecto de página y sonido
- **Movimiento:** la hoja se levanta desde la esquina inferior, se pliega en diagonal, se curva sobre un cilindro (el radio crece a mitad del giro) y se apoya sobre la otra página con sombra proyectada y sombreado según su inclinación. Al arrastrar, la hoja sigue al dedo o al mouse; con clic en los bordes, flechas laterales o teclado hace el mismo recorrido (un giro completo dura 720 ms; ajustable con `FLIP_MS`, `LIFT` y el radio en `js/flipbook.js`).
- **Páginas en reposo:** son imágenes normales (nítidas); WebGL solo dibuja la hoja mientras se mueve. Sin WebGL, o con «reducir movimiento» activado en el sistema, el cambio de página es directo (sin animación).
- **Sonido:** cada `page-flip-N.wav` = roce suave que crece mientras la hoja se levanta + el sonido real tomado del video de referencia. Se reproduce solo al pasar de página, con velocidad y volumen levemente distintos cada vez, y se silencia con el botón 🔊.

## Tecnologías
HTML5, CSS3, JavaScript vanilla, WebGL (propio) y PDF.js (Mozilla, licencia Apache 2.0, en `assets/vendor/pdfjs/`).

## Notas
- `relatedLabel` (opcional, en `articles.js`): encabezado propio de «Más artículos…» para un artículo (hoy solo el 00: «Más artículos escritos por estos profesores:»).
- Extremos de la revista: con cantidad par de páginas termina en la contraportada; con cantidad impar termina en el último pliego completo (sin página en blanco).
- **Descargar PDF:** el botón ⬇ (a la izquierda de la barra de control del lector) descarga el PDF original del artículo abierto, con el título como nombre de archivo. Se toma de `pdf` en `articles.js`; si un artículo no tiene PDF, el botón no aparece.
