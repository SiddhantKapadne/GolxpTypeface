(function () {
  "use strict";

  var GLYPH_GRID_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  var WAVE_LETTERS = ["O", "K", "R", "E", "L", "A", "X"];

  var PATTERN_MQ = "(max-width: 640px)";

  var musicGraph = null;

  function ensureMusicGraph(audio) {
    if (musicGraph || !audio) return musicGraph;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      var ctx = new Ctx();
      var src = ctx.createMediaElementSource(audio);
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.86;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      musicGraph = {
        ctx: ctx,
        analyser: analyser,
        freq: new Uint8Array(analyser.frequencyBinCount),
      };
      return musicGraph;
    } catch (err) {
      return null;
    }
  }

  function resumeMusicAudio() {
    if (!musicGraph || !musicGraph.ctx) return;
    if (musicGraph.ctx.state === "suspended") {
      musicGraph.ctx.resume().catch(function () {});
    }
  }

  function readFrequencyBands() {
    if (!musicGraph) {
      return { bass: 0, mid: 0, high: 0, overall: 0 };
    }
    var a = musicGraph.analyser;
    var f = musicGraph.freq;
    a.getByteFrequencyData(f);
    var n = f.length;
    var i;
    var b0 = 0;
    var b1 = Math.max(3, Math.floor(n * 0.06));
    var m0 = b1;
    var m1 = Math.floor(n * 0.22);
    var h0 = m1;
    var h1 = Math.floor(n * 0.55);
    var sum = function (lo, hi) {
      var s = 0;
      for (i = lo; i < hi; i++) s += f[i];
      return s / ((hi - lo) * 255 + 0.0001);
    };
    var bass = sum(b0, b1);
    var mid = sum(m0, m1);
    var high = sum(h0, h1);
    var overall = sum(0, n);
    return { bass: bass, mid: mid, high: high, overall: overall };
  }

  function parsePositiveInt(value, fallback) {
    var n = parseInt(value, 10);
    return n > 0 ? n : fallback;
  }

  function readPatternConfig(root) {
    var ds = root.dataset;
    return {
      char: ds.char && String(ds.char).length ? String(ds.char)[0] : "O",
      colsWide: parsePositiveInt(ds.colsWide, 14),
      colsNarrow: parsePositiveInt(ds.colsNarrow, 8),
      rowsWide: parsePositiveInt(ds.rowsWide, 10),
      rowsNarrow: parsePositiveInt(ds.rowsNarrow, 12),
      falloff: (function () {
        var f = parseFloat(ds.falloff);
        return f > 0 && f <= 2 ? f : 0.42;
      })(),
      baseRem: (function () {
        var v = parseFloat(ds.baseRem);
        return v > 0 ? v : 1.1;
      })(),
      maxRem: (function () {
        var v = parseFloat(ds.maxRem);
        return v > 0 ? v : 2.35;
      })(),
      maxScale: (function () {
        var v = parseFloat(ds.maxScale);
        return v > 1 ? v : 1.65;
      })(),
    };
  }

  function patternViewportNarrow() {
    return window.matchMedia(PATTERN_MQ).matches;
  }

  function teardownPatternInteraction(root) {
    if (root._patternAbort) {
      root._patternAbort.abort();
      root._patternAbort = null;
    }
    if (root._patternMqListener) {
      root._patternMq.removeEventListener("change", root._patternMqListener);
      root._patternMqListener = null;
      root._patternMq = null;
    }
  }

  function fillGlyphRows() {
    var el = document.getElementById("glyph-rows");
    if (!el) return;
    el.textContent = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < GLYPH_GRID_LETTERS.length; i++) {
      var span = document.createElement("span");
      span.className = "glyph-rows-char";
      span.textContent = GLYPH_GRID_LETTERS[i];
      frag.appendChild(span);
    }
    el.appendChild(frag);
  }

  function setupGlyphBrowser() {
    var grid = document.getElementById("glyph-grid");
    var preview = document.getElementById("glyph-preview-char");
    if (!grid || !preview) return;

    function setSelected(ch) {
      preview.textContent = ch;
      var buttons = grid.querySelectorAll(".glyph-grid-btn");
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].dataset.glyph === ch;
        buttons[i].classList.toggle("is-selected", on);
        buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
    }

    grid.textContent = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < GLYPH_GRID_LETTERS.length; i++) {
      var ch = GLYPH_GRID_LETTERS[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "glyph-grid-btn";
      btn.textContent = ch;
      btn.dataset.glyph = ch;
      btn.setAttribute("aria-label", "Show " + ch);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        setSelected(this.dataset.glyph);
      });
      frag.appendChild(btn);
    }
    grid.appendChild(frag);
    setSelected("A");
  }

  function buildPattern(root) {
    var cfg = readPatternConfig(root);
    var cols = patternViewportNarrow() ? cfg.colsNarrow : cfg.colsWide;
    var rows = patternViewportNarrow() ? cfg.rowsNarrow : cfg.rowsWide;
    var total = cols * rows;

    root.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    root.textContent = "";
    var frag = document.createDocumentFragment();

    for (var n = 0; n < total; n++) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "pattern-cell";
      cell.setAttribute("aria-label", "Pattern tile");

      var span = document.createElement("span");
      span.className = "pattern-glyph";
      span.textContent = cfg.char;
      span.setAttribute("aria-hidden", "true");

      cell.appendChild(span);
      frag.appendChild(cell);
    }

    root.appendChild(frag);
    root.setAttribute(
      "aria-label",
      "Interactive repeating pattern of the letter " + cfg.char
    );
  }

  function setupPatternInteraction(root) {
    teardownPatternInteraction(root);

    var ac = new AbortController();
    root._patternAbort = ac;
    var signal = ac.signal;

    function cfg() {
      return readPatternConfig(root);
    }

    function clearAll() {
      var c = cfg();
      var cells = root.querySelectorAll(".pattern-cell");
      for (var i = 0; i < cells.length; i++) {
        var g = cells[i].querySelector(".pattern-glyph");
        if (g) {
          g.style.setProperty("--glyph-size", c.baseRem + "rem");
          g.style.setProperty("--glyph-scale", "1");
        }
      }
    }

    function updateFromPoint(clientX, clientY) {
      var c = cfg();
      var rect = root.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        clearAll();
        return;
      }

      var maxDist = Math.hypot(rect.width / 2, rect.height / 2) || 1;
      var cells = root.querySelectorAll(".pattern-cell");

      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var cr = cell.getBoundingClientRect();
        var mx = cr.left + cr.width / 2;
        var my = cr.top + cr.height / 2;
        var d = Math.hypot(clientX - mx, clientY - my);
        var t = Math.max(0, 1 - d / (maxDist * c.falloff));
        t = t * t;
        var rem = c.baseRem + (c.maxRem - c.baseRem) * t;
        var scale = 1 + (c.maxScale - 1) * t;
        var g = cell.querySelector(".pattern-glyph");
        if (g) {
          g.style.setProperty("--glyph-size", rem.toFixed(3) + "rem");
          g.style.setProperty("--glyph-scale", scale.toFixed(3));
        }
      }
    }

    root.addEventListener(
      "pointermove",
      function (e) {
        if (e.pointerType === "mouse" || e.pointerType === "pen") {
          updateFromPoint(e.clientX, e.clientY);
        }
      },
      { signal: signal }
    );

    root.addEventListener("pointerleave", clearAll, { signal: signal });

    root.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches.length) {
          var t = e.touches[0];
          updateFromPoint(t.clientX, t.clientY);
        }
      },
      { passive: true, signal: signal }
    );

    root.addEventListener("touchend", clearAll, { signal: signal });
    clearAll();

    var mq = window.matchMedia(PATTERN_MQ);
    root._patternMq = mq;
    root._patternMqListener = function () {
      teardownPatternInteraction(root);
      buildPattern(root);
      setupPatternInteraction(root);
    };
    mq.addEventListener("change", root._patternMqListener);
  }

  function setupTypeMusic() {
    var el = document.getElementById("type-music");
    var btn = document.getElementById("music-toggle");
    var wrap = document.getElementById("music-control");
    if (!el) return;
    el.volume = 0.35;
    ensureMusicGraph(el);
    el.addEventListener("playing", resumeMusicAudio);

    function syncUi() {
      var playing = !el.paused;
      if (wrap) {
        if (playing) wrap.classList.add("is-playing");
        else wrap.classList.remove("is-playing");
      }
      if (btn) {
        btn.setAttribute("aria-pressed", playing ? "true" : "false");
        btn.setAttribute(
          "aria-label",
          playing ? "Pause background music" : "Play background music"
        );
      }
    }

    el.addEventListener("play", syncUi);
    el.addEventListener("pause", syncUi);

    if (btn) {
      btn.addEventListener("click", function () {
        resumeMusicAudio();
        if (el.paused) {
          var p = el.play();
          if (p && typeof p.catch === "function") {
            p.catch(function () {});
          }
        } else {
          el.pause();
        }
      });
    }

    function tryPlay() {
      resumeMusicAudio();
      var p = el.play();
      if (p && typeof p.catch === "function") {
        p.then(resumeMusicAudio).catch(function () {});
      }
    }
    tryPlay();
    syncUi();

    function onFirstGesture() {
      resumeMusicAudio();
      tryPlay();
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    }
    document.addEventListener("pointerdown", onFirstGesture);
    document.addEventListener("keydown", onFirstGesture);
  }

  function setupWaveTrackButton() {
    var btn = document.getElementById("wave-track-btn");
    var el = document.getElementById("type-music");
    if (!btn || !el) return;
    btn.addEventListener("click", function () {
      resumeMusicAudio();
      try {
        el.currentTime = 0;
      } catch (err) {}
      if (el.paused) {
        var p = el.play();
        if (p && typeof p.catch === "function") {
          p.catch(function () {});
        }
      }
    });
  }

  function setupGlyphWave(canvas, audioEl) {
    if (!canvas || !canvas.getContext) return;
    var ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    var parent = canvas.parentElement;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 400;
    var H = 400;
    var lastW = -1;
    var lastH = -1;
    var rafId = 0;
    var lastFrame = performance.now();
    var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    var numRows = 12;
    var scrollX = [];
    var rowDir = [];
    (function initWaveRows() {
      var ir;
      for (ir = 0; ir < numRows; ir++) {
        scrollX.push(0);
        rowDir.push(ir % 2 === 0 ? 1 : -1);
      }
    })();
    var smooth = { bass: 0, mid: 0, high: 0, overall: 0 };
    var smoothFlow = { bass: 0, mid: 0, high: 0, overall: 0 };
    var prevBassSample = 0;
    var beatPulse = 0;

    function seedRowOffsets() {
      var cell = 36;
      var period = WAVE_LETTERS.length * cell;
      var r;
      for (r = 0; r < numRows; r++) {
        scrollX[r] = (r / numRows + 0.12 * hash(r + 4)) * period;
      }
    }

    function hash(n) {
      var x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    }

    function resize() {
      if (!parent) return;
      var rect = parent.getBoundingClientRect();
      var nw = Math.max(200, Math.floor(rect.width));
      var nh = Math.max(220, Math.floor(rect.height));
      if (nw === lastW && nh === lastH) return;
      lastW = nw;
      lastH = nh;
      W = nw;
      H = nh;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedRowOffsets();
    }

    function loop(now) {
      rafId = requestAnimationFrame(loop);
      if (document.visibilityState === "hidden") return;
      resize();
      var ts = now || performance.now();
      var dtSec = Math.min(0.055, (ts - lastFrame) / 1000);
      lastFrame = ts;

      var bands = mqReduce.matches
        ? { bass: 0, mid: 0, high: 0, overall: 0 }
        : readFrequencyBands();
      if (!mqReduce.matches && (!audioEl || audioEl.paused)) {
        bands = { bass: 0, mid: 0, high: 0, overall: 0 };
      }
      var t = ts * 0.001;
      var kFast = mqReduce.matches ? 0.09 : 0.11;
      var kFlow = mqReduce.matches ? 0.028 : 0.034;
      smooth.bass = smooth.bass * (1 - kFast) + bands.bass * kFast;
      smooth.mid = smooth.mid * (1 - kFast) + bands.mid * kFast;
      smooth.high = smooth.high * (1 - kFast) + bands.high * kFast;
      smooth.overall = smooth.overall * (1 - kFast) + bands.overall * kFast;
      smoothFlow.bass = smoothFlow.bass * (1 - kFlow) + bands.bass * kFlow;
      smoothFlow.mid = smoothFlow.mid * (1 - kFlow) + bands.mid * kFlow;
      smoothFlow.high = smoothFlow.high * (1 - kFlow) + bands.high * kFlow;
      smoothFlow.overall =
        smoothFlow.overall * (1 - kFlow) + bands.overall * kFlow;

      var playing = audioEl && !audioEl.paused;
      var bassDelta = Math.max(0, bands.bass - prevBassSample);
      prevBassSample = prevBassSample * 0.72 + bands.bass * 0.28;
      var offEnvelope = Math.max(0, bands.bass - smooth.bass);
      var kick = Math.min(
        1,
        bassDelta * 3.2 + offEnvelope * 2.1 + Math.max(0, bands.mid - smooth.mid) * 0.85
      );
      beatPulse = beatPulse * (playing ? 0.86 : 0.9) + kick * (playing ? 0.34 : 0);
      beatPulse = Math.min(1, beatPulse);

      var cellW = 32 + smoothFlow.overall * 7 + beatPulse * 2;
      var period = WAVE_LETTERS.length * cellW;
      var runMul = playing ? 1 : 0.18;
      if (mqReduce.matches) runMul *= 0.28;
      var baseRun = mqReduce.matches ? 9 : 18;
      var groove =
        smoothFlow.mid * 195 +
        smoothFlow.overall * 52 +
        smoothFlow.bass * 72;
      var pulseBoost = beatPulse * 108;
      var runSpeed = (baseRun + groove + pulseBoost) * runMul;

      var r;
      for (r = 0; r < numRows; r++) {
        var rowBoost = 0.62 + r * 0.11;
        var beatRow = 1 + beatPulse * 0.06 * (1 + r * 0.035);
        scrollX[r] += rowDir[r] * runSpeed * rowBoost * beatRow * dtSec;
        scrollX[r] = ((scrollX[r] % period) + period) % period;
      }

      ctx2d.fillStyle = "#0a0a0a";
      ctx2d.fillRect(0, 0, W, H);

      var padY = H * 0.07;
      var innerH = H - padY * 2;
      var rowStep = innerH / numRows;
      var fontBase = Math.max(9, Math.min(20, rowStep * 0.46));
      var fs =
        fontBase +
        smoothFlow.bass * 5 +
        smoothFlow.overall * 2.5 +
        beatPulse * 5;
      ctx2d.font = "600 " + fs + "px Gol, system-ui, sans-serif";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";

      for (r = 0; r < numRows; r++) {
        var yCenter = padY + rowStep * (r + 0.5);
        var off = scrollX[r];
        var c0 = Math.floor(off / cellW) - 2;
        var c1 = Math.ceil((off + W) / cellW) + 2;
        var c;
        for (c = c0; c < c1; c++) {
          var wl = WAVE_LETTERS.length;
          var letter = WAVE_LETTERS[((c % wl) + wl) % wl];
          var x = c * cellW - off + cellW * 0.5;
          var sway =
            Math.sin(t * (2.8 + smoothFlow.mid * 1.8) + c * 0.48 + r * 0.35) *
            (2.2 + smoothFlow.bass * 9 + beatPulse * 10);
          var ripple =
            Math.sin(t * (5.5 + smoothFlow.high * 4) + c * 0.85 + r * 0.2) *
            (1.1 + smoothFlow.high * 5 + beatPulse * 4.5);
          var y = yCenter + sway + ripple;
          var squash =
            1 +
            smoothFlow.bass * 0.09 +
            beatPulse * 0.11 +
            Math.abs(Math.sin(t * 5.5 + c * 0.35 + r)) * smoothFlow.mid * 0.09;
          ctx2d.fillStyle = "#e4e4e4";
          ctx2d.save();
          ctx2d.translate(x, y);
          ctx2d.scale(squash, 1);
          ctx2d.fillText(letter, 0, 0);
          ctx2d.restore();
        }
      }
      ctx2d.globalAlpha = 1;
    }

    function start() {
      lastFrame = performance.now();
      resize();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }

    if (parent && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resize).observe(parent);
    } else {
      window.addEventListener("resize", resize);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start);
    } else {
      start();
    }
  }

  function fillHeroMarquee() {
    var phrase = "quick brown fox";
    var gap = "      ";
    var repeats = 28;
    var parts = [];
    for (var r = 0; r < repeats; r++) parts.push(phrase);
    var line = parts.join(gap) + gap;
    var segs = document.querySelectorAll(".hero-marquee-seg");
    for (var s = 0; s < segs.length; s++) segs[s].textContent = line;
  }

  function initInteractions() {
    setupTypeMusic();
    setupWaveTrackButton();
    fillHeroMarquee();
    fillGlyphRows();
    setupGlyphBrowser();
    var pattern = document.getElementById("pattern");
    if (pattern) {
      buildPattern(pattern);
      setupPatternInteraction(pattern);
    }
    var waveCanvas = document.getElementById("wave-canvas");
    var musicEl = document.getElementById("type-music");
    if (waveCanvas) setupGlyphWave(waveCanvas, musicEl);
  }

  document.addEventListener("DOMContentLoaded", initInteractions);
})();
