import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { fetchSurahs, fetchPageMeta, getAudioBase, getGlobalRecitator, loadTimestampsForSurah, fetchQuranPage } from "../../utils/reciterAudio.js";

const _MUSHAF_PAGES = 604;
const _API3D = "https://api.alquran.cloud/v1";

const _VS3D = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const _PAGE_FS = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform float u_curl;
uniform float u_dir;
uniform sampler2D u_tex;
uniform sampler2D u_texNext;

void main() {
  vec2 uv = v_uv;
  float spineDist = abs(uv.x - 0.5);
  float spineShadow = smoothstep(0.0, 0.08, spineDist) * 0.35 + 0.65;

  vec4 colCur = texture2D(u_tex, uv);
  vec4 colNext = texture2D(u_texNext, uv);
  
  float t = clamp(u_curl, 0.0, 1.0);
  vec4 col = mix(colCur, colNext, t);
  col.rgb *= spineShadow;

  gl_FragColor = col;
}
`;

const _CVR_FS = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;

void main() {
  vec2 uv = v_uv;
  vec3 leather = vec3(0.12, 0.06, 0.02);
  vec3 gold = vec3(0.85, 0.72, 0.35);
  
  float bx = min(uv.x, 1.0 - uv.x);
  float by = min(uv.y, 1.0 - uv.y);
  float border = smoothstep(0.03, 0.04, min(bx, by)) - smoothstep(0.045, 0.055, min(bx, by));
  
  vec3 col = mix(leather, gold, border * 0.8);
  gl_FragColor = vec4(col, 1.0);
}
`;

function _cprog(gl, vsSrc, fsSrc) {
  if (!gl) return null;
  function createShader(gl, type, source) {
    try {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("Shader compile warning:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    } catch (e) {
      console.warn("Error creating shader:", e);
      return null;
    }
  }
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  try {
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Program link warning:", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  } catch (e) {
    console.warn("Error linking program:", e);
    return null;
  }
}

function _makeTex(gl) {
  if (!gl || (gl.isContextLost && gl.isContextLost())) return null;
  try {
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([248, 246, 240, 255]));
    return tex;
  } catch (e) {
    console.warn("Error creating texture:", e);
    return null;
  }
}

function _uploadTex(gl, tex, canvas) {
  if (!gl || !tex || !canvas || (gl.isContextLost && gl.isContextLost())) return;
  try {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  } catch (e) {
    console.warn("Error uploading texture:", e);
  }
}

function _renderSpread(leftAyahs, leftPageNum, rightAyahs, rightPageNum, w, h) {
  if (typeof document === "undefined") return null;
  try {
    const cvs = document.createElement("canvas");
    if (!cvs || typeof cvs.getContext !== "function") return null;
    cvs.width = Math.max(256, w || 980);
    cvs.height = Math.max(160, h || 600);
    
    let ctx = null;
    try {
      ctx = cvs.getContext("2d", { alpha: false }) || cvs.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return null;

    const pw = cvs.width / 2;
    const ph = cvs.height;

    ctx.fillStyle = "#fcfbf7";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.strokeStyle = "rgba(201, 168, 76, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, pw - 32, ph - 32);
    ctx.strokeRect(pw + 16, 16, pw - 32, ph - 32);

    const grad = ctx.createLinearGradient(pw - 30, 0, pw + 30, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.18)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(pw - 30, 0, 60, ph);

    ctx.fillStyle = "#8b7355";
    ctx.font = "14px serif";
    ctx.textAlign = "center";
    ctx.fillText("Page " + leftPageNum, pw / 2, ph - 24);
    ctx.fillText("Page " + rightPageNum, pw + pw / 2, ph - 24);

    const drawAyahs = (ayahs, startX, startY, width, height) => {
      if (!ayahs || !ayahs.length) {
        ctx.fillStyle = "#aaa";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Chargement...", startX + width / 2, startY + height / 2);
        return;
      }
      const fullText = ayahs.map(a => a.text + " ﴿" + (a.numberInSurah || "") + "﴾").join(" ");
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "18px 'Amiri Quran', serif";
      ctx.textAlign = "right";
      try {
        ctx.direction = "rtl";
      } catch {
        // Ignore if rtl direction not supported on older browsers
      }

      const words = fullText.split(" ");
      let line = "";
      let y = startY + 36;
      const lineHeight = 28;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > width - 48 && n > 0) {
          ctx.fillText(line, startX + width - 24, y);
          line = words[n] + " ";
          y += lineHeight;
          if (y > startY + height - 48) break;
        } else {
          line = testLine;
        }
      }
      if (line && y <= startY + height - 48) {
        ctx.fillText(line, startX + width - 24, y);
      }
    };

    drawAyahs(rightAyahs, pw, 24, pw - 32, ph - 64);
    drawAyahs(leftAyahs, 16, 24, pw - 32, ph - 64);

    return cvs;
  } catch (err) {
    console.warn("Error rendering 2D spread canvas:", err);
    return null;
  }
}

export function QuranBook3DPage({ surahs }) {
  const navigate = useNavigate();
  const cvs3 = React.useRef(null);
  const raf3 = React.useRef(null);
  const gl3  = React.useRef(null);
  const glState = React.useRef({
    pageProg: null, coverProg: null,
    buf: null, uvBuf: null,
    texCur: null, texNext: null,
  });
  const pd  = React.useRef({});
  const tx0 = React.useRef(0);

  const [ph,    setPh]    = React.useState("cover");
  const [sp,    setSp]    = React.useState(1);
  const [ready, setReady] = React.useState(false);
  const [sz,    setSz]    = React.useState({ w: 860, h: 528 });
  const [pn,    setPn]    = React.useState("");
  const [glError, setGlError] = React.useState(false);

  const SR = React.useRef({
    phase: "cover", spread: 1, curl: 0, targetCurl: 0,
    dir: 1, flipping: false, time: 0, texDirty: false,
  });

  React.useEffect(() => {
    const u = () => {
      if (typeof window === "undefined") return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min((vw - 14) * 0.97, (vh - 85) * 1.63, 980);
      setSz({ w: Math.max(300, Math.round(w)), h: Math.max(200, Math.round(w / 1.63)) });
    };
    u();
    window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);

  const uploadSpreadTex = React.useCallback((spread, which = "cur") => {
    const gl = gl3.current;
    const gls = glState.current;
    if (!gl || (gl.isContextLost && gl.isContextLost()) || spread === 0) return;
    const rp = 2 * spread - 1, lp = Math.min(2 * spread, _MUSHAF_PAGES);
    const rd = pd.current[rp], ld = pd.current[lp];
    if (!rd || !ld) return;
    const cvs = _renderSpread(ld, lp, rd, rp, sz.w, sz.h);
    if (!cvs) return;
    const tex = which === "cur" ? gls.texCur : gls.texNext;
    _uploadTex(gl, tex, cvs);
  }, [sz.w, sz.h]);

  const prefetch = React.useCallback(async (spread, onReady) => {
    if (spread === 0) return;
    const pages = [
      2 * spread - 1, 2 * spread,
      2 * spread + 1, 2 * spread + 2,
      2 * spread - 3, 2 * spread - 2,
    ].filter(p => p >= 1 && p <= _MUSHAF_PAGES);

    const crit = [2 * spread - 1, 2 * spread].filter(p => p >= 1 && p <= _MUSHAF_PAGES);

    await Promise.all(crit.map(async p => {
      if (pd.current[p] !== undefined) return;
      pd.current[p] = null;
      try {
        const d = await fetch(`${_API3D}/page/${p}/quran-uthmani`).then(r => r.json()).then(r => r.data?.ayahs || []);
        pd.current[p] = d;
      } catch {
        pd.current[p] = [];
      }
    }));

    if (onReady) onReady();

    for (const p of pages) {
      if (pd.current[p] !== undefined) continue;
      pd.current[p] = null;
      try {
        const d = await fetch(`${_API3D}/page/${p}/quran-uthmani`).then(r => r.json()).then(r => r.data?.ayahs || []);
        pd.current[p] = d;
      } catch {
        pd.current[p] = [];
      }
    }
  }, []);

  React.useEffect(() => {
    const cvs = cvs3.current;
    if (!cvs || typeof cvs.getContext !== "function") {
      setGlError(true);
      return;
    }
    let gl = null;
    try {
      gl = cvs.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: false }) ||
           cvs.getContext("experimental-webgl") ||
           cvs.getContext("webgl2");
    } catch (err) {
      console.warn("Failed to obtain WebGL context:", err);
      gl = null;
    }
    if (!gl) {
      console.warn("WebGL not available in this environment");
      setGlError(true);
      return;
    }
    gl3.current = gl;
    setGlError(false);

    const handleContextLost = (e) => {
      e.preventDefault();
      if (raf3.current) cancelAnimationFrame(raf3.current);
      console.warn("WebGL context lost");
    };
    const handleContextRestored = () => {
      console.info("WebGL context restored");
    };

    cvs.addEventListener("webglcontextlost", handleContextLost, false);
    cvs.addEventListener("webglcontextrestored", handleContextRestored, false);

    const gls = glState.current;
    gls.pageProg  = _cprog(gl, _VS3D, _PAGE_FS);
    gls.coverProg = _cprog(gl, _VS3D, _CVR_FS);

    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,-1, 1,1, -1,1]);
    const uvs   = new Float32Array([ 0, 1,  1, 1,  0,0,  1, 1, 1,0,  0,0]);
    gls.buf   = gl.createBuffer();
    if (gls.buf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gls.buf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    }
    gls.uvBuf = gl.createBuffer();
    if (gls.uvBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gls.uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    }

    gls.texCur  = _makeTex(gl);
    gls.texNext = _makeTex(gl);

    const draw = (ts) => {
      if (!gl || (gl.isContextLost && gl.isContextLost())) return;
      const s = SR.current;
      s.time = ts * 0.001;

      const diff = s.targetCurl - s.curl;
      s.curl += diff * (diff > 0 ? 0.15 : 0.18);
      if (Math.abs(diff) < 0.003) {
        s.curl = s.targetCurl;
        if (s.targetCurl === 1 && s.flipping) {
          s.flipping = false;
          s.curl = 0;
          s.targetCurl = 0;
          s.spread += s.dir > 0 ? 1 : -1;
          s.spread = Math.max(1, Math.min(302, s.spread));
          s.texDirty = true;
          setSp(s.spread);
        }
      }

      try {
        gl.viewport(0, 0, cvs.width, cvs.height);
        gl.clearColor(0.03, 0.01, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (s.phase === "cover") {
          const prog = gls.coverProg;
          if (prog && gls.buf && gls.uvBuf) {
            gl.useProgram(prog);
            const aPos = gl.getAttribLocation(prog, "a_pos");
            const aUV  = gl.getAttribLocation(prog, "a_uv");
            if (aPos >= 0) {
              gl.enableVertexAttribArray(aPos);
              gl.bindBuffer(gl.ARRAY_BUFFER, gls.buf);
              gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
            }
            if (aUV >= 0) {
              gl.enableVertexAttribArray(aUV);
              gl.bindBuffer(gl.ARRAY_BUFFER, gls.uvBuf);
              gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
            }

            const uTime = gl.getUniformLocation(prog, "u_time");
            if (uTime) gl.uniform1f(uTime, s.time);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
          }
        } else {
          const prog = gls.pageProg;
          if (prog && gls.buf && gls.uvBuf) {
            gl.useProgram(prog);

            const aPos = gl.getAttribLocation(prog, "a_pos");
            const aUV  = gl.getAttribLocation(prog, "a_uv");
            if (aPos >= 0) {
              gl.enableVertexAttribArray(aPos);
              gl.bindBuffer(gl.ARRAY_BUFFER, gls.buf);
              gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
            }
            if (aUV >= 0) {
              gl.enableVertexAttribArray(aUV);
              gl.bindBuffer(gl.ARRAY_BUFFER, gls.uvBuf);
              gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
            }

            if (gls.texCur) {
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, gls.texCur);
              const uTex = gl.getUniformLocation(prog, "u_tex");
              if (uTex) gl.uniform1i(uTex, 0);
            }

            if (gls.texNext) {
              gl.activeTexture(gl.TEXTURE1);
              gl.bindTexture(gl.TEXTURE_2D, gls.texNext);
              const uTexNext = gl.getUniformLocation(prog, "u_texNext");
              if (uTexNext) gl.uniform1i(uTexNext, 1);
            }

            const uCurl = gl.getUniformLocation(prog, "u_curl");
            if (uCurl) gl.uniform1f(uCurl, s.curl);

            const uDir = gl.getUniformLocation(prog, "u_dir");
            if (uDir) gl.uniform1f(uDir, s.dir);

            const uTime = gl.getUniformLocation(prog, "u_time");
            if (uTime) gl.uniform1f(uTime, s.time);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
          }
        }
      } catch (renderErr) {
        console.warn("Draw loop exception:", renderErr);
      }

      raf3.current = requestAnimationFrame(draw);
    };

    raf3.current = requestAnimationFrame(draw);
    return () => {
      if (raf3.current) cancelAnimationFrame(raf3.current);
      if (cvs) {
        cvs.removeEventListener("webglcontextlost", handleContextLost);
        cvs.removeEventListener("webglcontextrestored", handleContextRestored);
      }
      try {
        if (gl && !gl.isContextLost?.()) {
          if (gls.buf) gl.deleteBuffer(gls.buf);
          if (gls.uvBuf) gl.deleteBuffer(gls.uvBuf);
          if (gls.texCur) gl.deleteTexture(gls.texCur);
          if (gls.texNext) gl.deleteTexture(gls.texNext);
          if (gls.pageProg) gl.deleteProgram(gls.pageProg);
          if (gls.coverProg) gl.deleteProgram(gls.coverProg);
        }
      } catch (cleanupErr) {
        console.warn("WebGL cleanup error:", cleanupErr);
      }
    };
  }, []);

  const openBook = useCallback(() => {
    SR.current.phase = "open";
    SR.current.spread = 1;
    setPh("open");
    setSp(1);
    setReady(false);
    prefetch(1, () => {
      uploadSpreadTex(1, "cur");
      prefetch(2, () => uploadSpreadTex(2, "next"));
      setReady(true);
    });
  }, [prefetch, uploadSpreadTex]);

  const startFlip = useCallback((direction) => {
    const s = SR.current;
    if (s.flipping || s.phase !== "open") return;
    const nextSpread = s.spread + (direction > 0 ? 1 : -1);
    if (nextSpread < 1 || nextSpread > 302) return;

    s.dir = direction;
    s.flipping = true;
    s.targetCurl = 1.0;
    uploadSpreadTex(nextSpread, "next");
  }, [uploadSpreadTex]);

  const flipFwd = () => startFlip(1);
  const flipBwd = () => startFlip(-1);

  const jumpTo = useCallback((pageNum) => {
    const p = Math.max(1, Math.min(_MUSHAF_PAGES, parseInt(pageNum, 10) || 1));
    const targetSp = Math.floor((p - 1) / 2) + 1;
    const s = SR.current;
    s.spread = targetSp;
    s.curl = 0;
    s.targetCurl = 0;
    s.flipping = false;
    setSp(targetSp);
    setReady(false);
    prefetch(targetSp, () => {
      uploadSpreadTex(targetSp, "cur");
      prefetch(targetSp + 1, () => uploadSpreadTex(targetSp + 1, "next"));
      prefetch(targetSp - 1, () => uploadSpreadTex(targetSp - 1, "next"));
      setReady(true);
    });
  }, [prefetch, uploadSpreadTex]);

  const onTS = (e) => {
    tx0.current = e.touches[0].clientX;
  };
  const onTE = (e) => {
    const dx = e.changedTouches[0].clientX - tx0.current;
    if (Math.abs(dx) > 44) {
      if (dx < 0) flipFwd();
      else flipBwd();
    }
  };

  const rp = 2 * sp - 1;
  const lp = Math.min(2 * sp, _MUSHAF_PAGES);

  const BB = {
    background: "rgba(201,168,76,0.12)",
    border: "1px solid rgba(201,168,76,0.35)",
    color: "#c9a84c",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all .15s",
  };
  const BBh = (e, h) => {
    e.currentTarget.style.background = h ? "rgba(201,168,76,0.22)" : "rgba(201,168,76,0.12)";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080300",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px 8px",
      boxSizing: "border-box",
      color: "#e8d8b8",
      fontFamily: "'Amiri Quran', serif",
      userSelect: "none",
    }}>
      {/* Top bar */}
      <div style={{
        width: "100%",
        maxWidth: sz.w,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        padding: "0 4px",
      }}>
        <button style={BB} onClick={() => navigate("/")}
          onMouseEnter={e => BBh(e, true)} onMouseLeave={e => BBh(e, false)}>
          ← Retour
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#c9a84c" }}>
            Mushaf 3D (Page {rp}{lp <= _MUSHAF_PAGES ? `–${lp}` : ""})
          </span>
          <button style={BB} onClick={() => navigate("/book")}
            onMouseEnter={e => BBh(e, true)} onMouseLeave={e => BBh(e, false)}>
            Mode 2D
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div style={{
        position: "relative",
        boxShadow: "0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,168,76,0.2)",
        borderRadius: 8,
        overflow: "hidden",
        cursor: ph === "cover" && !glError ? "pointer" : "default",
        minHeight: 280,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#120802",
      }}
      onClick={ph === "cover" && !glError ? openBook : undefined}
      onTouchStart={onTS} onTouchEnd={onTE}>
        {!glError ? (
          <canvas ref={cvs3} width={sz.w} height={sz.h} style={{ display: "block" }} />
        ) : (
          <div style={{
            padding: 32,
            textAlign: "center",
            maxWidth: 480,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}>
            <h2 style={{ fontSize: 22, margin: 0, color: "#c9a84c" }}>
              Affichage 3D non disponible
            </h2>
            <p style={{ color: "#a89060", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              Votre navigateur ou appareil ne supporte pas l&apos;accélération matérielle WebGL. Vous pouvez utiliser le Mode 2D pour une lecture fluide du Mushaf.
            </p>
            <button style={BB} onClick={() => navigate("/book")}>
              Passer au Mode 2D →
            </button>
          </div>
        )}

        {!glError && ph === "cover" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <h1 style={{
              fontSize: 32, margin: 0, color: "#c9a84c",
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              letterSpacing: 2,
            }}>
              القرآن الكريم
            </h1>
            <p style={{
              color: "#a89060", fontSize: 14, marginTop: 12,
            }}>
              Cliquez pour ouvrir le Mushaf
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {ph === "open" && (
        <div style={{
          width: "100%",
          maxWidth: sz.w,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          padding: "0 4px",
          flexWrap: "wrap",
          gap: 8,
        }}>
          <button style={BB} onClick={flipBwd} disabled={sp <= 1}
            onMouseEnter={e => BBh(e, true)} onMouseLeave={e => BBh(e, false)}>
            ← PRÉC.
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min={1}
              max={604}
              placeholder="Page..."
              value={pn}
              onChange={e => setPn(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") jumpTo(pn); }}
              style={{
                width: 70,
                padding: "6px 8px",
                background: "rgba(201,168,76,0.08)",
                border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 6,
                color: "#e8d8b8",
                textAlign: "center",
                fontSize: 13,
              }}
            />
            <button style={BB} onClick={() => jumpTo(pn)}>Aller</button>
          </div>

          <button style={BB} onClick={flipFwd} disabled={lp >= _MUSHAF_PAGES}
            onMouseEnter={e => BBh(e, true)} onMouseLeave={e => BBh(e, false)}>
            SUIV. →
          </button>
        </div>
      )}
    </div>
  );
}

export default QuranBook3DPage;
