/* ==========================================================
   curl.js — Hoja de papel flexible (WebGL, sin librerías).
   La hoja es una malla que se pliega sobre una línea de doblez
   (que puede ser DIAGONAL) y se enrolla en un cilindro de radio R:
     - lo que queda antes del doblez permanece plano,
     - lo que pasa el doblez se curva sobre el cilindro (el papel se ve
       cada vez más de costado, luego su reverso),
     - el resto queda plano, apoyado sobre la hoja, mostrando el dorso.
   Incluye sombra proyectada (suave, más intensa junto al doblez),
   sombreado según la inclinación del papel y un leve brillo.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var COLS = 96, ROWS = 48;

  var VS = [
    'attribute vec2 a_uv;',
    'uniform vec2 u_size, u_spine, u_view, u_n, u_light;',
    'uniform float u_f, u_R, u_D, u_pass;',
    'varying vec2 v_uv; varying float v_th; varying vec3 v_N; varying float v_a;',
    'void main(){',
    '  vec2 pos = a_uv * u_size;',
    '  float d = dot(u_n, pos), u = d - u_f;',
    '  float nd = d, z = 0.0, th = 0.0; vec3 N = vec3(0.0, 0.0, 1.0);',
    '  if (u > 0.0) {',
    '    float lim = 3.14159265 * u_R;',
    '    if (u <= lim) { th = u / u_R; nd = u_f + u_R * sin(th); z = u_R * (1.0 - cos(th)); N = vec3(-u_n * sin(th), cos(th)); }',
    '    else { th = 3.14159265; nd = u_f - (u - lim); z = 2.0 * u_R; N = vec3(0.0, 0.0, -1.0); }',
    '  }',
    '  vec2 p2 = pos + u_n * (nd - d), sp; float a = 0.0;',
    '  if (u_pass > 0.5) {',
    '    sp = p2 + u_light * z;',
    '    a = (u > 0.0) ? 0.34 * (1.0 - 0.55 * z / (2.0 * u_R)) : 0.0;',
    '  } else {',
    '    vec2 c = vec2(0.0, u_size.y * 0.5);',
    '    sp = c + (p2 - c) / (1.0 - z / u_D);',     // perspectiva suave: lo que se eleva parece más cercano
    '  }',
    '  vec2 px = u_spine + sp;',
    '  gl_Position = vec4(px.x / u_view.x * 2.0 - 1.0, 1.0 - px.y / u_view.y * 2.0, -z / u_size.x, 1.0);',
    '  v_uv = a_uv; v_th = th; v_N = N; v_a = a;',
    '}'
  ].join('\n');

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform sampler2D u_front, u_back; uniform float u_pass, u_alpha;',
    'varying vec2 v_uv; varying float v_th; varying vec3 v_N; varying float v_a;',
    'void main(){',
    '  if (u_pass > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, v_a * u_alpha); return; }',
    '  bool back = v_th > 1.5708;',
    '  vec3 c = back ? texture2D(u_back, vec2(1.0 - v_uv.x, v_uv.y)).rgb : texture2D(u_front, v_uv).rgb;',
    '  vec3 N = normalize(v_N); if (back) N = -N;',
    '  vec3 L = normalize(vec3(-0.35, -0.45, 0.82));',
    '  float dif = max(dot(N, L), 0.0);',
    '  float sh = 0.672 + 0.40 * dif;',
    '  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 10.0) * 0.10;',
    '  vec3 col = c * sh + spec;',
    '  gl_FragColor = vec4(col * u_alpha, u_alpha);',
    '}'
  ].join('\n');

  /** Devuelve null si el navegador no soporta WebGL. */
  CC.createCurl = function (canvas) {
    var opt = { alpha: true, premultipliedAlpha: true, antialias: true, depth: true };
    var gl = canvas.getContext('webgl', opt) || canvas.getContext('experimental-webgl', opt);
    if (!gl) return null;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog;
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { return null; }
    gl.useProgram(prog);

    var U = {}; ['u_size', 'u_spine', 'u_view', 'u_n', 'u_light', 'u_f', 'u_R', 'u_D', 'u_pass', 'u_alpha', 'u_front', 'u_back']
      .forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

    /* malla: cuadrícula de (COLS+1)×(ROWS+1) vértices con coordenadas 0..1 */
    var uv = new Float32Array((COLS + 1) * (ROWS + 1) * 2), idx = new Uint16Array(COLS * ROWS * 6), k = 0, m = 0, r, c;
    for (r = 0; r <= ROWS; r++) for (c = 0; c <= COLS; c++) { uv[k++] = c / COLS; uv[k++] = r / ROWS; }
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      var a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1;
      idx[m++] = a; idx[m++] = b; idx[m++] = d; idx[m++] = b; idx[m++] = e; idx[m++] = d;
    }
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_uv'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    /* texturas */
    var texs = {};
    function mk(source, w, h, pixels) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (pixels) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    var paper = mk(null, 1, 1, new Uint8Array([255, 253, 244, 255]));

    return {
      paper: paper,
      /** Textura de una página (se crea una vez y se reutiliza). */
      tex: function (key, img) { return texs[key] || (texs[key] = mk(img)); },
      dropAll: function () { for (var q in texs) gl.deleteTexture(texs[q]); texs = {}; },
      resize: function (w, h, dpr) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height); this.view = [w, h];
      },
      clear: function () { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); },
      /** o: { n[2], f, R, spine[2], size[2], front, back, alpha } */
      draw: function (o) {
        this.clear();
        gl.uniform2f(U.u_size, o.size[0], o.size[1]); gl.uniform2f(U.u_spine, o.spine[0], o.spine[1]);
        gl.uniform2f(U.u_view, this.view[0], this.view[1]); gl.uniform2f(U.u_n, o.n[0], o.n[1]);
        gl.uniform1f(U.u_f, o.f); gl.uniform1f(U.u_R, o.R); gl.uniform1f(U.u_D, o.size[0] * 5);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        /* 1) sombras proyectadas (dos capas: contacto nítido y penumbra amplia) */
        gl.disable(gl.DEPTH_TEST); gl.uniform1f(U.u_pass, 1);
        var L = [[0.55, 0.9, 0.55], [1.5, 2.3, 0.28]];
        for (var i = 0; i < L.length; i++) {
          gl.uniform2f(U.u_light, L[i][0], L[i][1]);
          gl.uniform1f(U.u_alpha, L[i][2] * o.alpha);
          gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
        }
        /* 2) la hoja */
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.uniform1f(U.u_pass, 0); gl.uniform1f(U.u_alpha, o.alpha);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.front || paper); gl.uniform1i(U.u_front, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, o.back || paper); gl.uniform1i(U.u_back, 1);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      },
      destroy: function () { this.dropAll(); var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    };
  };
})();
