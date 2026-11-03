# Revista Científica · ConCiencia

Sección de Revista Científica del Club de Ciencias ConCiencia (HTML + CSS + JavaScript, sin dependencias externas).

## Cómo ejecutarla
- **Opción simple:** abrí `index.html` con doble clic en tu navegador (funciona sin servidor).
- **Opción recomendada para publicar o probar en el celular:** desde esta carpeta ejecutá `python3 -m http.server 8000` y entrá a `http://localhost:8000`. También podés subir la carpeta entera a Netlify.

## Estructura
```
revista/
├── index.html
├── css/styles.css        ← colores y tipografías en las variables de :root
├── js/
│   ├── articles.js       ← ÚNICO lugar donde se registran los artículos
│   ├── flipbook.js       ← motor de revista 3D (propio, sin librerías)
│   ├── search.js         ← buscador por autor, tema/título y fecha
│   ├── assistant.js      ← Marie Curie (preguntas frecuentes)
│   └── main.js           ← rutas, menú, lector, sonido
├── assets/
│   ├── images/           ← portada, marie.png, covers/
│   ├── articles/<id>/    ← páginas de cada revista (01.jpg, 02.jpg…)
│   └── sounds/page-flip.wav
└── README.md
```

## Cómo agregar un artículo nuevo
1. Exportá la revista como imágenes (una por página, misma proporción; proporción 8:11; para lectura ampliada nítida conviene ≥ 1240×1705 px, JPG) y guardalas en `assets/articles/<id>/` con nombres `01.jpg`, `02.jpg`, …
2. Guardá la miniatura de portada (ideal 480×660 px) en `assets/images/covers/<id>.jpg`.
3. En `js/articles.js`, copiá un objeto del arreglo `RAW` y completá: `id`, `title`, `author`, `date` (AAAA-MM-DD), `topic`, `cover`, `pagesPath`, `pageCount`, `number`.
4. Listo: aparece en la galería, el buscador y en "Más artículos de este/a estudiante" (se agrupan por nombre de autor, escrito igual).
`author` y `date` pueden quedar vacíos (no se muestra nada). Para borrar el de demostración, eliminá el objeto `demo-01` y su carpeta.

## Lectura ampliada
Doble clic (o doble toque) sobre el centro de una página, o el botón «Ampliar», abre una vista de solo lectura con scroll; se sale con el botón o Escape y la revista vuelve a la misma página.

## Qué reemplazar
- **Tipografías y colores:** son aproximados. Editá `--font-script`, `--font-body` y los colores en `:root` (`css/styles.css`).
- **Marie Curie:** `assets/images/marie.png` es un recorte de una captura; reemplazalo por el original (`Marie.png` del sitio).
- **Sonido:** `assets/sounds/page-flip.wav` es sintetizado; podés reemplazarlo por un sonido real con el mismo nombre.
- **Portada:** `assets/images/portada.jpg` es una ilustración generada; cambiala por la definitiva.

## Tecnologías
HTML5 semántico, CSS3 (variables, grid, transformaciones 3D) y JavaScript vanilla (rutas por hash, Pointer Events para mouse y táctil). Sin bibliotecas externas.
