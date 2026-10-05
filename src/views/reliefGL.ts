// Relieve sombreado bajo el globo: un shader que, para cada píxel, calcula qué
// lon/lat se ve (misma inversa que src/geo/orthoInvert.ts, validada contra d3)
// y lee ese punto de la imagen equirectangular de ETOPO 2022.

const VS = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D tex;
uniform float height;     // alto del canvas en px CSS
uniform float dpr;
uniform float scale;
uniform vec2 translate;
uniform vec2 rot;         // λ, φ en radianes
uniform float dim;
out vec4 color;
const float PI = 3.141592653589793;
void main() {
  vec2 px = vec2(gl_FragCoord.x, height * dpr - gl_FragCoord.y) / dpr;
  float x = (px.x - translate.x) / scale;
  float y = (translate.y - px.y) / scale;
  float r = sqrt(x * x + y * y);
  float z = sqrt(max(0.0, 1.0 - r * r));
  float cx = z * cos(rot.y) + y * sin(rot.y);
  float cz = -z * sin(rot.y) + y * cos(rot.y);
  float lon = atan(x, cx) - rot.x;
  float lat = asin(clamp(cz, -1.0, 1.0));
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), (0.5 * PI - lat) / PI);
  // En el meridiano 180 la u salta de 1 a 0: se corrige la derivada para que el mipmap no dibuje una costura
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  if (abs(dx.x) > 0.5) dx.x -= sign(dx.x);
  if (abs(dy.x) > 0.5) dy.x -= sign(dy.x);
  vec3 c = textureGrad(tex, uv, dx, dy).rgb * dim;
  float a = clamp((1.0 - r) * scale * dpr, 0.0, 1.0);
  color = vec4(c * a, a);
}`;

export interface ReliefView {
  scale: number;
  translate: [number, number];
  rotate: [number, number];
}

export function createRelief(container: HTMLElement) {
  const canvas = document.createElement("canvas");
  canvas.className = "relief-gl";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
  let ready = false;
  let size = { w: 0, h: 0, dpr: 1 };
  let loading: Promise<void> | null = null;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};

  if (gl) {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    for (const n of ["tex", "height", "dpr", "scale", "translate", "rot", "dim"]) uniforms[n] = gl.getUniformLocation(prog, n);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  return {
    supported: !!gl,
    get ready() {
      return ready;
    },

    resize(w: number, h: number) {
      const dpr = window.devicePixelRatio || 1;
      size = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    },

    /** Descarga la imagen una sola vez; elige la grande solo si la pantalla la aprovecha. */
    load(big: boolean): Promise<void> {
      if (!gl) return Promise.reject(new Error("WebGL2 no disponible"));
      loading ??= new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
          if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
          ready = true;
          resolve();
        };
        img.onerror = () => {
          loading = null;
          reject(new Error("No se pudo cargar el relieve"));
        };
        img.src = `${import.meta.env.BASE_URL}data/relief/relief-${big ? 4096 : 2048}.jpg`;
      });
      return loading;
    },

    render(v: ReliefView, dim: number) {
      if (!gl || !ready) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(uniforms.tex, 0);
      gl.uniform1f(uniforms.height, size.h);
      gl.uniform1f(uniforms.dpr, size.dpr);
      gl.uniform1f(uniforms.scale, v.scale);
      gl.uniform2f(uniforms.translate, v.translate[0], v.translate[1]);
      gl.uniform2f(uniforms.rot, (v.rotate[0] * Math.PI) / 180, (v.rotate[1] * Math.PI) / 180);
      gl.uniform1f(uniforms.dim, dim);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    clear() {
      if (!gl) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}
