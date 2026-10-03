/** A single, connected texture mesh: the shoulder blends into the torso and
 * feather tips lead the gesture. The portrait frame never moves. */
export function createMascotRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
  if (!gl) return null
  const vertexSource = `
    attribute vec2 a_uv;
    uniform float u_time;
    varying vec2 v_uv;
    float bell(vec2 p, vec2 center, vec2 radius) {
      vec2 d = (p - center) / radius;
      return exp(-dot(d, d) * 2.0);
    }
    vec2 turn(vec2 p, vec2 pivot, float a) {
      vec2 d = p - pivot;
      return pivot + mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
    }
    void main() {
      vec2 p = a_uv;
      v_uv = a_uv;
      // 2.4 seconds of greeting, then 4.4 seconds of rest. The envelope
      // settles both position and velocity before the next greeting.
      float t = mod(u_time, 6.8);
      float envelope = smoothstep(0.15, 0.65, t) * (1.0 - smoothstep(1.9, 2.55, t));
      float wave = sin((t - 0.15) * 6.0) * envelope;
      float follow = sin((t - 0.28) * 6.0) * envelope;
      // Pin the white rim and shadow. Everything inside remains one mesh.
      float interior = 1.0 - smoothstep(0.375, 0.435, length(p - vec2(0.5)));
      float wing = smoothstep(0.60, 0.76, p.x)
        * smoothstep(0.32, 0.43, p.y) * (1.0 - smoothstep(0.72, 0.83, p.y));
      vec2 shoulder = vec2(0.675, 0.69);
      vec2 wingPose = turn(p, shoulder, wave * 0.17);
      // Slightly delayed flex through the outer feathers, rather than a
      // rigid cutout rotating around a hard seam at the shoulder.
      wingPose.x += follow * 0.012 * smoothstep(0.68, 0.84, p.x);
      p += (wingPose - a_uv) * wing * interior;
      float head = bell(a_uv, vec2(0.43, 0.36), vec2(0.27, 0.28));
      vec2 headPose = turn(a_uv, vec2(0.47, 0.64), follow * 0.025);
      p += (headPose - a_uv) * head * interior;
      float body = bell(a_uv, vec2(0.46, 0.69), vec2(0.3, 0.29));
      p.y += body * interior * (sin(u_time * 1.848) * 0.0025 - envelope * 0.003);
      gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
    }
  `
  const fragmentSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_image;
    void main() { gl_FragColor = texture2D(u_image, v_uv); }
  `
  const shaders: WebGLShader[] = []
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let texture: WebGLTexture | null = null
  const dispose = () => {
    if (texture) gl.deleteTexture(texture)
    if (buffer) gl.deleteBuffer(buffer)
    if (program) gl.deleteProgram(program)
    shaders.forEach(shader => gl.deleteShader(shader))
  }
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Mascot shader unavailable')
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Mascot shader failed')
      return shader
    }
    program = gl.createProgram()
    if (!program) throw new Error('Mascot program unavailable')
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Mascot program failed')
    gl.useProgram(program)
    // Small mesh, uploaded once; animation changes only the time uniform.
    const vertices: number[] = []
    const n = 48
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      vertices.push(x / n, y / n, (x + 1) / n, y / n, x / n, (y + 1) / n,
        x / n, (y + 1) / n, (x + 1) / n, y / n, (x + 1) / n, (y + 1) / n)
    }
    buffer = gl.createBuffer()
    if (!buffer) throw new Error('Mascot buffer unavailable')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
    const uv = gl.getAttribLocation(program, 'a_uv')
    gl.enableVertexAttribArray(uv)
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0)
    texture = gl.createTexture()
    if (!texture) throw new Error('Mascot texture unavailable')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)
    const time = gl.getUniformLocation(program, 'u_time')
    return {
      draw(seconds: number) {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform1f(time, seconds)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2)
      },
      dispose,
    }
  } catch {
    dispose()
    return null
  }
}
