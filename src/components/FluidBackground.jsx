import { useEffect, useRef } from 'react';

const FluidBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const config = {
      SIM_RESOLUTION: 256,
      DYE_RESOLUTION: 1024,
      VELOCITY_DISSIPATION: 0.99,
      DENSITY_DISSIPATION: 1.0,
      PRESSURE: 0.8,
      CURL: 45,
      SPLAT_FORCE: 5000,
      SPLAT_RADIUS: 0.05,
      HUE_CHANGE_SPEED: 0.0005,
    };

    let gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    let ext = gl.getExtension('OES_texture_half_float');
    let supportLinear = gl.getExtension('OES_texture_half_float_linear');
    const texType = ext ? ext.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;

    if (!ext) return;

    const baseVertexShader = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
          vUv = aPosition * 0.5 + 0.5;
          vL = vUv - vec2(texelSize.x, 0.0);
          vR = vUv + vec2(texelSize.x, 0.0);
          vT = vUv + vec2(0.0, texelSize.y);
          vB = vUv - vec2(0.0, texelSize.y);
          gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const displayShaderSource = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float uHue;
      
      vec3 hueRotate(vec3 col, float hue) {
          const vec3 k = vec3(0.57735, 0.57735, 0.57735);
          float cosAngle = cos(hue);
          return col * cosAngle + cross(k, col) * sin(hue) + k * dot(k, col) * (1.0 - cosAngle);
      }
      vec3 sharp(vec3 c) { return c * c * (3.0 - 2.0 * c); }

      void main () {
          vec3 color = texture2D(uTexture, vUv).rgb;
          color = hueRotate(color, uHue);
          color = sharp(color);
          gl_FragColor = vec4(color, 1.0);
      }
    `;

    const splatShaderSource = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec2 point;
      uniform vec3 color;
      uniform float radius;
      uniform float aspectRatio;
      uniform int isVelocity;
      void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 base = texture2D(uTexture, vUv).xyz;
          float d = exp(-dot(p, p) / radius);
          if (isVelocity > 0) {
              gl_FragColor = vec4(base + color * d, 1.0);
          } else {
              gl_FragColor = vec4(mix(base, color, d), 1.0);
          }
      }
    `;

    const initShaderSource = `precision highp float; varying vec2 vUv; void main () { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;
    
    const advectionShaderSource = `precision highp float; varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation; void main () { vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; gl_FragColor = dissipation * texture2D(uSource, coord); }`;
    const divergenceShaderSource = `precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; void main () { float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x; float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y; vec2 C = texture2D(uVelocity, vUv).xy; if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; } if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; } gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`;
    const curlShaderSource = `precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; void main () { float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y; float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x; gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`;
    const vorticityShaderSource = `precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt; void main () { float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x; float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x; float C = texture2D(uCurl, vUv).x; vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0; vec2 vel = texture2D(uVelocity, vUv).xy; gl_FragColor = vec4(vel + force * dt, 0.0, 1.0); }`;
    const pressureShaderSource = `precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uPressure; uniform sampler2D uDivergence; void main () { float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x; float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x; float divergence = texture2D(uDivergence, vUv).x; float pressure = (L + R + B + T - divergence) * 0.25; gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0); }`;
    const gradientSubtractShaderSource = `precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uPressure; uniform sampler2D uVelocity; void main () { float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x; float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x; vec2 velocity = texture2D(uVelocity, vUv).xy; velocity.xy -= vec2(R - L, T - B); gl_FragColor = vec4(velocity, 0.0, 1.0); }`;

    let velocity, density, divergence, curl, pressure;
    let splatProgram, advectionProgram, divergenceProgram, curlProgram, vorticityProgram, pressureProgram, gradienSubtractProgram, displayProgram, initProgram;
    let quadBuffer;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    function createProgram(gl, vertexShader, fragmentShader) {
      let program = gl.createProgram();
      gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShader));
      gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShader));
      gl.linkProgram(program);
      return program;
    }

    function createShader(gl, type, source) {
      let shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    function createTexture(gl, width, height) {
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, supportLinear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, supportLinear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, texType, null);
      return texture;
    }

    function createDoubleFBO(gl, width, height) {
      let fbo1 = gl.createFramebuffer();
      let tex1 = createTexture(gl, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex1, 0);

      let fbo2 = gl.createFramebuffer();
      let tex2 = createTexture(gl, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex2, 0);

      return {
        read: { fbo: fbo1, tex: tex1 },
        write: { fbo: fbo2, tex: tex2 },
        swap: function() { let temp = this.read; this.read = this.write; this.write = temp; }
      };
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) { r = g = b = l; } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r, g, b };
    }

    function splat(x, y, dx, dy, color, radius) {
      let aspectRatio = canvas.width / canvas.height;
      let r = radius || config.SPLAT_RADIUS;

      gl.viewport(0, 0, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      gl.useProgram(splatProgram);
      gl.uniform1i(gl.getUniformLocation(splatProgram, 'uTexture'), 0);
      gl.uniform1i(gl.getUniformLocation(splatProgram, 'isVelocity'), 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform2f(gl.getUniformLocation(splatProgram, 'point'), x / canvas.width, 1.0 - y / canvas.height);
      gl.uniform3f(gl.getUniformLocation(splatProgram, 'color'), dx, -dy, 0.0);
      gl.uniform1f(gl.getUniformLocation(splatProgram, 'radius'), r);
      gl.uniform1f(gl.getUniformLocation(splatProgram, 'aspectRatio'), aspectRatio);
      blit(velocity.write.fbo);
      velocity.swap();

      if(color) {
        gl.viewport(0, 0, config.DYE_RESOLUTION, config.DYE_RESOLUTION);
        gl.useProgram(splatProgram);
        gl.uniform1i(gl.getUniformLocation(splatProgram, 'uTexture'), 0);
        gl.uniform1i(gl.getUniformLocation(splatProgram, 'isVelocity'), 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        gl.uniform3f(gl.getUniformLocation(splatProgram, 'color'), color.r, color.g, color.b);
        gl.uniform1f(gl.getUniformLocation(splatProgram, 'radius'), r); // 这里也使用传入的 radius
        blit(density.write.fbo);
        density.swap();
      }
    }

    function init() {
      splatProgram = createProgram(gl, baseVertexShader, splatShaderSource);
      advectionProgram = createProgram(gl, baseVertexShader, advectionShaderSource);
      divergenceProgram = createProgram(gl, baseVertexShader, divergenceShaderSource);
      curlProgram = createProgram(gl, baseVertexShader, curlShaderSource);
      vorticityProgram = createProgram(gl, baseVertexShader, vorticityShaderSource);
      pressureProgram = createProgram(gl, baseVertexShader, pressureShaderSource);
      gradienSubtractProgram = createProgram(gl, baseVertexShader, gradientSubtractShaderSource);
      displayProgram = createProgram(gl, baseVertexShader, displayShaderSource);
      initProgram = createProgram(gl, baseVertexShader, initShaderSource);

      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

      velocity = createDoubleFBO(gl, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      density = createDoubleFBO(gl, config.DYE_RESOLUTION, config.DYE_RESOLUTION);
      pressure = createDoubleFBO(gl, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      
      let divTex = createTexture(gl, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      let divFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, divFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, divTex, 0);
      divergence = { fbo: divFBO, tex: divTex };

      let curlTex = createTexture(gl, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      let curlFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, curlFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, curlTex, 0);
      curl = { fbo: curlFBO, tex: curlTex };

      gl.useProgram(initProgram);
      gl.viewport(0, 0, config.DYE_RESOLUTION, config.DYE_RESOLUTION);
      blit(density.read.fbo);

      for (let i = 0; i < 16; i++) {
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        let dx = (Math.random() - 0.5) * 200; 
        let dy = (Math.random() - 0.5) * 200;
        
        let color = hslToRgb(Math.random(), 0.8, 0.6); 
        
        let randomRadius = 0.2 + Math.random() * 0.4;
        
        splat(x, y, dx, dy, color, randomRadius);
      }
    }

    function blit(destinationFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, destinationFBO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    init();

    let lastTime = Date.now();
    let globalHue = Math.random();
    let animationId;

    function update() {
      let now = Date.now();
      let dt = Math.min((now - lastTime) / 1000, 0.016);
      lastTime = now;
      globalHue += config.HUE_CHANGE_SPEED;
      if(globalHue > 1) globalHue -= 1;

      gl.viewport(0, 0, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      gl.useProgram(advectionProgram);
      gl.uniform2f(gl.getUniformLocation(advectionProgram, 'texelSize'), 1.0 / config.SIM_RESOLUTION, 1.0 / config.SIM_RESOLUTION);
      gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dt'), dt);
      gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dissipation'), config.VELOCITY_DISSIPATION);
      gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uVelocity'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uSource'), 0);
      blit(velocity.write.fbo); velocity.swap();

      gl.viewport(0, 0, config.DYE_RESOLUTION, config.DYE_RESOLUTION);
      gl.useProgram(advectionProgram);
      gl.uniform2f(gl.getUniformLocation(advectionProgram, 'texelSize'), 1.0 / config.DYE_RESOLUTION, 1.0 / config.DYE_RESOLUTION);
      gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dissipation'), config.DENSITY_DISSIPATION);
      gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uVelocity'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uSource'), 1);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
      blit(density.write.fbo); density.swap();

      gl.viewport(0, 0, config.SIM_RESOLUTION, config.SIM_RESOLUTION);
      gl.useProgram(curlProgram);
      gl.uniform2f(gl.getUniformLocation(curlProgram, 'texelSize'), 1.0 / config.SIM_RESOLUTION, 1.0 / config.SIM_RESOLUTION);
      gl.uniform1i(gl.getUniformLocation(curlProgram, 'uVelocity'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      blit(curl.fbo);

      gl.useProgram(vorticityProgram);
      gl.uniform2f(gl.getUniformLocation(vorticityProgram, 'texelSize'), 1.0 / config.SIM_RESOLUTION, 1.0 / config.SIM_RESOLUTION);
      gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'curl'), config.CURL);
      gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'dt'), dt);
      gl.uniform1i(gl.getUniformLocation(vorticityProgram, 'uVelocity'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(gl.getUniformLocation(vorticityProgram, 'uCurl'), 1);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, curl.tex);
      blit(velocity.write.fbo); velocity.swap();

      gl.useProgram(divergenceProgram);
      gl.uniform2f(gl.getUniformLocation(divergenceProgram, 'texelSize'), 1.0 / config.SIM_RESOLUTION, 1.0 / config.SIM_RESOLUTION);
      gl.uniform1i(gl.getUniformLocation(divergenceProgram, 'uVelocity'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      blit(divergence.fbo);

      gl.useProgram(pressureProgram);
      gl.uniform2f(gl.getUniformLocation(pressureProgram, 'texelSize'), 1.0 / config.SIM_RESOLUTION, 1.0 / config.SIM_RESOLUTION);
      gl.uniform1i(gl.getUniformLocation(pressureProgram, 'uDivergence'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, divergence.tex);
      gl.uniform1i(gl.getUniformLocation(pressureProgram, 'uPressure'), 1);
      for(let i=0; i<10; i++) {
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
          blit(pressure.write.fbo); pressure.swap();
      }

      gl.useProgram(gradienSubtractProgram);
      gl.uniform2f(gl.getUniformLocation(gradienSubtractProgram, 'texelSize'), 1.0 / config.SIM_RESOLUTION, 1.0 / config.SIM_RESOLUTION);
      gl.uniform1i(gl.getUniformLocation(gradienSubtractProgram, 'uPressure'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
      gl.uniform1i(gl.getUniformLocation(gradienSubtractProgram, 'uVelocity'), 1);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      blit(velocity.write.fbo); velocity.swap();

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(displayProgram);
      gl.uniform1i(gl.getUniformLocation(displayProgram, 'uTexture'), 0);
      gl.uniform1f(gl.getUniformLocation(displayProgram, 'uHue'), globalHue * 6.28318);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
      blit(null);

      animationId = requestAnimationFrame(update);
    }
    update();

    let lastMouse = { x: 0, y: 0 };
    const handleMove = (x, y) => {
        if (!lastMouse.x) { lastMouse = { x, y }; return; }
        let dx = x - lastMouse.x;
        let dy = y - lastMouse.y;
        lastMouse = { x, y };
        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
            let color = hslToRgb(globalHue, 0.9, 0.65);
            splat(x, y, dx * 5.0, dy * 5.0, color); 
        }
    };

    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full z-0" 
    />
  );
};

export default FluidBackground;
