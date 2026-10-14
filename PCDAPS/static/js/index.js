/* PC-DAPS project page: animated teaser, best-of-k illustration, the two animated toy experiments,
   the phase-retrieval outcome chart, the sample gallery and the image lightbox. */
(function () {
  'use strict';

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var HAS_IO = 'IntersectionObserver' in window;
  var timelines = [];

  // ------------------------------------------------------------------ helpers
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hash(i) { var s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }

  function mixColor(a, b, t) {
    var pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    var pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    return 'rgb(' + pa.map(function (v, i) { return Math.round(lerp(v, pb[i], t)); }).join(',') + ')';
  }

  function decodeU8(b64, lo, hi) {
    var s = atob(b64);
    var out = new Float32Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = lo + s.charCodeAt(i) / 255 * (hi - lo);
    return out;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) { throw new Error(url + ': ' + r.status); }
      return r.json();
    });
  }

  function watchVisibility(el, fn, threshold) {
    if (!HAS_IO) { fn(true); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { fn(e.isIntersecting); });
    }, { threshold: threshold == null ? 0.12 : threshold }).observe(el);
  }

  function setToggleIcon(btn, playing) {
    var icon = btn.querySelector('span');
    if (icon) { icon.className = playing ? 'anim-icon-pause' : 'anim-icon-play'; }
    btn.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
  }

  // Size a canvas to its CSS box (times the device pixel ratio) and return a context in CSS pixels.
  function fitCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  // A looping clock in ms with play/pause and a scrubber; it only ticks while its element is on screen.
  function Timeline(opts) {
    var self = this;
    this.total = opts.total;
    this.render = opts.render;
    this.t = REDUCED && opts.reducedAt != null ? opts.reducedAt : 0;
    this.playing = !REDUCED;
    this.visible = false;
    this.raf = null;
    this.last = null;
    this.btn = opts.controls ? qs('[data-action="toggle"]', opts.controls) : null;
    this.scrub = opts.controls ? qs('.anim-scrub', opts.controls) : null;
    if (this.btn) {
      setToggleIcon(this.btn, this.playing);
      this.btn.addEventListener('click', function () { self.setPlaying(!self.playing); });
    }
    if (this.scrub) {
      this.scrub.addEventListener('input', function () {
        self.setPlaying(false);
        self.t = self.scrub.value / 1000 * (self.total - 1);
        self.draw();
      });
    }
    watchVisibility(opts.el, function (v) { self.visible = v; if (v) { self.draw(); } self.kick(); });
    timelines.push(this);
    this.draw();
  }

  Timeline.prototype.setPlaying = function (p) {
    this.playing = p;
    if (this.btn) { setToggleIcon(this.btn, p); }
    this.kick();
  };

  Timeline.prototype.kick = function () {
    var self = this;
    if (!this.playing || !this.visible || this.raf) { return; }
    this.last = null;
    this.raf = requestAnimationFrame(function step(now) {
      if (!self.playing || !self.visible) { self.raf = null; return; }
      if (self.last != null) { self.t = (self.t + Math.min(now - self.last, 100)) % self.total; }
      self.last = now;
      self.draw();
      self.raf = requestAnimationFrame(step);
    });
  };

  Timeline.prototype.draw = function () {
    if (this.scrub) { this.scrub.value = Math.round(this.t / (this.total - 1) * 1000); }
    this.render(this.t);
  };

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { timelines.forEach(function (tl) { tl.draw(); }); }, 60);
  });

  // ------------------------------------------------------------------ teaser
  var TEASER = {
    base: './static/images/teaser/',
    blocks: [[0, 3], [2, 4]],             // the paper's layout: two faces per block
    frames: 4,
    interval: 1700,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'measurement', label: 'Measurement' },
      { key: 'dps', label: 'DPS', unit: 'run' },
      { key: 'dpnp', label: 'DPnP', unit: 'run' },
      { key: 'daps', label: 'DAPS', unit: 'run' },
      { key: 'pcdaps', label: 'PC-DAPS', unit: 'particle', ours: true }
    ]
  };

  function initTeaser() {
    var root = qs('#teaser');
    var controls = qs('#teaser-controls');
    if (!root || !controls) { return; }
    root.setAttribute('role', 'img');
    var frameImgs = [];
    var units = [];
    for (var f = 0; f < TEASER.frames; f++) { frameImgs.push([]); }

    TEASER.blocks.forEach(function (ids) {
      var block = document.createElement('div');
      block.className = 'teaser-block';
      TEASER.columns.forEach(function (col, c) {
        var head = document.createElement('div');
        head.className = 'teaser-head tc-' + (c + 1) + (col.ours ? ' is-ours' : '');
        head.textContent = col.label;
        var small = document.createElement('small');
        small.textContent = col.unit ? col.unit + ' 1/' + TEASER.frames : ' ';
        if (col.unit) { units.push({ el: small, unit: col.unit }); }
        head.appendChild(small);
        block.appendChild(head);
      });
      ids.forEach(function (id) {
        TEASER.columns.forEach(function (col, c) {
          var cell = document.createElement('div');
          cell.className = 'tcell tc-' + (c + 1) + (col.ours ? ' is-ours' : '');
          if (!col.unit) {
            var im = new Image();
            im.alt = '';
            im.className = 'is-active';
            im.src = TEASER.base + 'img' + id + '_' + col.key + '.jpg';
            cell.appendChild(im);
          } else {
            for (var k = 0; k < TEASER.frames; k++) {
              var fr = new Image();
              fr.alt = '';
              fr.decoding = 'async';
              fr.src = TEASER.base + 'img' + id + '_' + col.key + '_' + (k + 1) + '.jpg';
              if (k === 0) { fr.className = 'is-active'; }
              cell.appendChild(fr);
              frameImgs[k].push(fr);
            }
          }
          block.appendChild(cell);
        });
      });
      root.appendChild(block);
    });

    var cur = 0;
    var playing = !REDUCED;
    var visible = false;
    var timer = null;
    var dots = qsa('.run-dot', controls);
    var nums = qsa('[data-teaser-run]', controls);
    var btn = qs('[data-action="toggle"]', controls);

    function show(k) {
      frameImgs[cur].forEach(function (im) { im.classList.remove('is-active'); });
      cur = k;
      frameImgs[cur].forEach(function (im) { im.classList.add('is-active'); });
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === k);
        d.setAttribute('aria-pressed', i === k ? 'true' : 'false');
      });
      nums.forEach(function (n) { n.textContent = String(k + 1); });
      units.forEach(function (u) { u.el.textContent = u.unit + ' ' + (k + 1) + '/' + TEASER.frames; });
    }

    function schedule() {
      clearInterval(timer);
      timer = null;
      if (playing && visible) {
        timer = setInterval(function () { show((cur + 1) % TEASER.frames); }, TEASER.interval);
      }
    }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        playing = false;
        setToggleIcon(btn, false);
        show(i);
        schedule();
      });
    });
    btn.addEventListener('click', function () {
      playing = !playing;
      setToggleIcon(btn, playing);
      if (playing) { show((cur + 1) % TEASER.frames); }
      schedule();
    });
    setToggleIcon(btn, playing);
    show(0);
    watchVisibility(root, function (v) { visible = v; schedule(); });
  }

  // ------------------------------------------------------- best-of-k strip
  function initBestOfK() {
    var root = qs('#bok');
    if (!root) { return; }
    var details = root.closest('details');
    var rows = qsa('.bok-row', root);
    var daps = qsa('.bok-cell', rows[0]);
    var ours = qsa('.bok-cell', rows[1]);
    var oracle = qs('.bok-oracle', rows[0]);
    var status = qs('[data-bok-status]', root);
    var MSG = {
      scan: 'Best-of-4 compares every run with the ground truth…',
      pick: 'Best-of-4 keeps one run and discards three, a choice that needs the ground truth.'
    };
    var timers = [];
    var onScreen = false;
    var running = false;

    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function stop() { timers.forEach(clearTimeout); timers = []; running = false; }
    function active() { return onScreen && (!details || details.open); }

    function reset() {
      daps.concat(ours).forEach(function (c) {
        c.classList.remove('is-scanning', 'is-judged', 'is-picked', 'is-discarded');
      });
      oracle.classList.remove('is-active');
      status.textContent = MSG.scan;
    }

    function finalState() {
      daps.forEach(function (c) {
        c.classList.add('is-judged');
        c.classList.add(c.dataset.pick ? 'is-picked' : 'is-discarded');
      });
      ours.forEach(function (c) { c.classList.add('is-judged'); });
      status.textContent = MSG.pick;
    }

    function run() {
      stop();
      running = true;
      reset();
      var t = 700;
      daps.forEach(function (c) {
        later(t, function () { c.classList.add('is-scanning'); oracle.classList.add('is-active'); });
        later(t + 650, function () { c.classList.remove('is-scanning'); c.classList.add('is-judged'); });
        t += 950;
      });
      later(t, function () {
        oracle.classList.remove('is-active');
        daps.forEach(function (c) { c.classList.add(c.dataset.pick ? 'is-picked' : 'is-discarded'); });
        status.textContent = MSG.pick;
      });
      later(t + 1700, function () { ours.forEach(function (c) { c.classList.add('is-judged'); }); });
      later(t + 6000, function () { if (active()) { run(); } else { running = false; } });
    }

    function update() {
      if (REDUCED) { finalState(); return; }
      if (active() && !running) { run(); }
      if (!active()) { stop(); finalState(); }
    }

    watchVisibility(root, function (v) { onScreen = v; update(); }, 0.35);
    if (details) { details.addEventListener('toggle', update); }
  }

  // ------------------------------------------------ toy 1: premature mode selection
  var DOT = { blue: '#5aa2ff', orange: '#ff7a3d', white: '#ffffff' };

  function initToyModes() {
    var fig = qs('#toy-modes');
    if (!fig) { return; }
    var base = './static/images/toy/';
    Promise.all([
      fetchJSON('./static/data/toy_modes.json'),
      loadImage(base + 'exact_posterior.png'), loadImage(base + 'daps.png'),
      loadImage(base + 'msdaps.png'), loadImage(base + 'daps_zoom.png')
    ]).then(function (r) {
      buildToyModes(fig, r[0], { exact: r[1], daps: r[2], pcdaps: r[3], zoom: r[4] });
    }).catch(function (err) { console.warn('toy animation unavailable', err); });
  }

  function buildToyModes(fig, D, heat) {
    var L = D.levels.length;
    var logSpan = Math.log10(D.sigma_hi) - Math.log10(D.sigma_lo);
    function uOf(s) { return (Math.log10(D.sigma_hi) - Math.log10(s)) / logSpan; }
    var uLev = D.levels.map(uOf);
    var uZoom = D.zoom.levels.map(uOf);
    var gatePre = D.gate_level - 1;                      // last level before the gate replaced particles
    var uGate = uLev[gatePre];                           // the gate level (sigma = D.gate_sigma)
    var kClean = D.k_clean;

    var M = {};
    ['exact', 'daps', 'pcdaps'].forEach(function (m) {
      M[m] = { pos: decodeU8(D.methods[m].pos, D.y_lo, D.y_hi), dest: D.methods[m].dest, trails: D.methods[m].trails };
    });
    var zoomPos = decodeU8(D.zoom.pos, D.zoom.lo, D.zoom.hi);
    var jitter = [];
    for (var i = 0; i < Math.max(D.n, D.zoom.n); i++) { jitter.push(hash(i)); }

    var SWEEP = 9500;
    var GATE = 2400;
    var END = 3800;
    var A = SWEEP * uGate;
    var total = SWEEP + GATE + END;

    function state(t) {
      if (t < A) { return { u: t / SWEEP, g: 0, post: false, final: false }; }
      if (t < A + GATE) { return { u: uGate, g: (t - A) / GATE, post: false, final: false, hold: true }; }
      if (t < A + GATE + SWEEP * (1 - uGate)) { return { u: uGate + (t - A - GATE) / SWEEP, g: 1, post: true, final: false }; }
      return { u: 1, g: 1, post: true, final: true };
    }

    function frac(u, us) {
      if (u <= us[0]) { return 0; }
      var n = us.length;
      if (u >= us[n - 1]) { return n - 1; }
      var k = 0;
      while (k < n - 2 && us[k + 1] <= u) { k++; }
      return k + (u - us[k]) / (us[k + 1] - us[k]);
    }

    function at(arr, i, f, n) {
      var k0 = Math.floor(f);
      var k1 = Math.min(k0 + 1, n - 1);
      var a = arr[i * n + k0];
      return lerp(a, arr[i * n + k1], f - k0);
    }

    // y of particle i of method m at fractional level f; PC-DAPS particles pruned at the gate glide across
    // during the gate hold and stay on their post-gate positions afterwards.
    function posAt(m, i, f, st) {
      var P = M[m].pos;
      if (m === 'pcdaps' && M[m].dest[i] === 1) {
        if (st.hold) { return lerp(P[i * L + gatePre], P[i * L + gatePre + 1], ease(st.g)); }
        if (st.post) { f = Math.max(f, gatePre + 1); }
      }
      return at(P, i, f, L);
    }

    function dotColor(m, dest, st) {
      if (m === 'exact') { return dest ? DOT.white : DOT.blue; }
      if (m === 'daps') { return dest ? DOT.orange : DOT.blue; }
      if (!dest) { return DOT.blue; }
      if (st.hold) { return mixColor(DOT.orange, DOT.blue, ease(st.g)); }
      return st.post ? DOT.blue : DOT.orange;
    }

    function glyph(ctx, kind, x, y, s) {
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#ffffff';
      if (kind === 'good') {
        ctx.fillStyle = '#2a78d6';
        ctx.beginPath(); ctx.arc(x, y, s, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      } else if (kind === 'open') {
        ctx.fillStyle = cssVar('--surface') || '#ffffff';
        ctx.strokeStyle = cssVar('--ink') || '#0b0b0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, s * 0.92, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#eb6834';
        ctx.beginPath();
        ctx.moveTo(x, y - s * 1.25); ctx.lineTo(x + s * 1.25, y); ctx.lineTo(x, y + s * 1.25); ctx.lineTo(x - s * 1.25, y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    var panels = qsa('.toy-panel', fig).map(function (el) {
      return { key: el.dataset.panel, canvas: qs('canvas', el) };
    });
    var flag = qs('[data-gate-flag]', fig);
    var readout = qs('[data-readout]', fig);
    var controls = qs('[data-controls]', fig);

    function drawPanel(p, st) {
      var c = fitCanvas(p.canvas);
      var ctx = c.ctx;
      var MR = 15;
      var MB = 20;
      var pw = c.w - MR;
      var ph = c.h - MB;
      var zoom = p.key === 'zoom';
      var lo = zoom ? D.zoom.lo : D.y_lo;
      var hi = zoom ? D.zoom.hi : D.y_hi;
      function Y(v) { return (hi - v) / (hi - lo) * ph; }
      var ux = st.u * pw;
      var ink = cssVar('--ink-2') || '#4a5360';
      var r = Math.max(1.2, pw / 150);

      ctx.fillStyle = '#0c0a12';
      ctx.fillRect(0, 0, pw, ph);
      var img = heat[p.key];
      if (img && ux > 0.5) {
        ctx.drawImage(img, 0, 0, img.width * st.u, img.height, 0, 0, ux, ph);
      }

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();

      if (zoom) {
        ctx.strokeStyle = 'rgba(47, 179, 174, 0.9)';
        ctx.lineWidth = 1;
        [D.a, D.a + D.b].forEach(function (v) {
          ctx.beginPath(); ctx.moveTo(0, Y(v)); ctx.lineTo(pw, Y(v)); ctx.stroke();
        });
      }
      if (p.key === 'pcdaps' && st.u >= uGate - 1e-6) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = st.hold ? 1.5 + Math.sin(st.g * Math.PI) * 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(uGate * pw, 0); ctx.lineTo(uGate * pw, ph); ctx.stroke();
      }

      if (!zoom) {
        var m = p.key;
        var f = frac(st.u, uLev);
        // a few particle trails
        M[m].trails.forEach(function (tr) {
          if (f < D.trail_start) { return; }
          var pruned = m === 'pcdaps' && tr.dest === 1;
          var col = tr.dest ? (m === 'exact' ? DOT.white : DOT.orange) : DOT.blue;
          var kEnd = Math.floor(f);
          var pre = [];
          var postPts = [];
          for (var k = D.trail_start; k <= kEnd; k++) {
            var pt = [uLev[k] * pw, Y(tr.y[k])];
            if (pruned && st.post && k > gatePre) { postPts.push(pt); } else { pre.push(pt); }
          }
          var head = [ux, Y(lerp(tr.y[Math.min(kEnd, L - 1)], tr.y[Math.min(kEnd + 1, L - 1)], f - kEnd))];
          var jump = null;
          if (pruned && st.hold) {
            jump = [[uGate * pw, Y(tr.y[gatePre])], [uGate * pw, Y(lerp(tr.y[gatePre], tr.y[gatePre + 1], ease(st.g)))]];
          } else if (pruned && st.post) {
            if (f < gatePre + 1) {
              jump = [[uLev[gatePre] * pw, Y(tr.y[gatePre])], [ux, Y(tr.y[gatePre + 1])]];
            } else {
              jump = [[uLev[gatePre] * pw, Y(tr.y[gatePre])], postPts[0]];
              postPts.push(head);
            }
          } else {
            pre.push(head);
          }
          strokePath(ctx, pre, col, false);
          if (jump) { strokePath(ctx, jump, mixColor(DOT.orange, DOT.blue, st.hold ? ease(st.g) : 1), true); }
          if (postPts.length) { strokePath(ctx, postPts, DOT.blue, false); }
        });
        // the particle cloud at the current noise level
        if (!st.final) {
          ctx.globalAlpha = 0.82;
          for (var i = 0; i < D.n; i++) {
            ctx.fillStyle = dotColor(m, M[m].dest[i], st);
            ctx.beginPath();
            ctx.arc(ux + (jitter[i] * 10 - 3), Y(posAt(m, i, f, st)), r, 0, 2 * Math.PI);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      } else if (!st.final) {
        var fz = frac(st.u, uZoom);
        var nz = D.zoom.levels.length;
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = DOT.orange;
        for (var j = 0; j < D.zoom.n; j++) {
          ctx.beginPath();
          ctx.arc(ux + (jitter[j] * 10 - 3), Y(at(zoomPos, j, fz, nz)), r, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (!st.final && st.u > 0 && st.u < 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ux, 0); ctx.lineTo(ux, ph); ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, pw - 1, ph - 1);

      // modes of the problem, on the clean (right) end
      var gs = Math.max(3.4, pw / 60);
      var gx = pw + MR / 2 + 0.5;
      if (zoom) {
        glyph(ctx, 'open', gx, Y(D.a), gs);
        glyph(ctx, 'bad', gx, Y(D.a + D.b), gs);
      } else {
        glyph(ctx, 'good', gx, Y(-D.a * kClean), gs);
        if (p.key === 'exact') { glyph(ctx, 'open', gx, Y(D.a * kClean), gs); }
        if (p.key === 'daps') { glyph(ctx, 'bad', gx, Y((D.a + D.b) * kClean), gs); }
      }

      // sigma ticks: 10 (left), 1, 0.1 (right), and the gate for PC-DAPS
      ctx.fillStyle = ink;
      ctx.font = '11px "Noto Sans", sans-serif';
      ctx.textBaseline = 'top';
      [[0, '10', 'left'], [0.5, '1', 'center'], [1, '0.1', 'right']].forEach(function (tk) {
        var x = tk[0] * pw;
        ctx.fillRect(Math.min(Math.round(x), pw - 1), ph, 1, 3);
        ctx.textAlign = tk[2];
        ctx.fillText(tk[1], x, ph + 5);
      });
      if (p.key === 'pcdaps') {
        ctx.font = '9px "Noto Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('0.3', uGate * pw, ph + 6);
      }
    }

    function strokePath(ctx, pts, color, dashed) {
      if (pts.length < 2) { return; }
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (dashed) { ctx.setLineDash([3, 3]); }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) { ctx.lineTo(pts[i][0], pts[i][1]); }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    function render(t) {
      var st = state(t);
      panels.forEach(function (p) { drawPanel(p, st); });
      fig.classList.toggle('is-final', st.final);
      if (flag) { flag.classList.toggle('is-visible', t >= A && t < A + GATE + 900); }
      if (readout) {
        var s = Math.pow(10, Math.log10(D.sigma_hi) - st.u * logSpan);
        readout.textContent = 'σ = ' + (s >= 1 ? s.toFixed(1) : s.toFixed(2)) + (st.hold ? '  (gate)' : '');
      }
    }

    new Timeline({ el: fig, total: total, render: render, controls: controls, reducedAt: total - 1 });
  }

  // ------------------------------------------- toy 2: Gaussian-mixture Langevin
  function initToyLangevin() {
    var fig = qs('#toy-langevin');
    if (!fig) { return; }
    Promise.all([
      fetchJSON('./static/data/toy_langevin.json'),
      loadImage('./static/images/toy/langevin_background.png')
    ]).then(function (r) { buildToyLangevin(fig, r[0], r[1]); })
      .catch(function (err) { console.warn('toy animation unavailable', err); });
  }

  function buildToyLangevin(fig, D, bg) {
    var ex = D.extent;
    var byKey = {};
    D.panels.forEach(function (p) { byKey[p.key] = p; });
    var panels = qsa('.toy-panel', fig).map(function (el, idx) {
      return { idx: idx, data: byKey[el.dataset.panel], canvas: qs('canvas', el) };
    });
    var readout = qs('[data-readout]', fig);
    var controls = qs('[data-controls]', fig);
    var RUN = 5600;
    var HOLD = 2800;
    var total = RUN + HOLD;

    function dot(ctx, x, y, rad, fill, ring) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = ring;
      ctx.stroke();
    }

    function drawPanel(p, t) {
      var c = fitCanvas(p.canvas);
      var ctx = c.ctx;
      var W = c.w;
      var H = c.h;
      var d = p.data;
      function X(x) { return (x - ex[0]) / (ex[1] - ex[0]) * W; }
      function Y(y) { return (ex[3] - y) / (ex[3] - ex[2]) * H; }
      var sx = W / (ex[1] - ex[0]);
      var sy = H / (ex[3] - ex[2]);

      if (bg) { ctx.drawImage(bg, 0, 0, W, H); } else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }

      ctx.strokeStyle = 'rgba(42, 120, 214, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Y(D.y)); ctx.lineTo(W, Y(D.y)); ctx.stroke();
      if (p.idx === 0) {
        var ly = Y(D.y) - 4;
        ctx.fillStyle = '#2a78d6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = 'italic 13px "Times New Roman", serif';
        ctx.fillText('x', 6, ly);
        ctx.font = '9px "Times New Roman", serif';
        ctx.fillText('2', 12.5, ly + 3);
        ctx.font = '13px "Times New Roman", serif';
        ctx.fillText('=', 20, ly);
        ctx.font = 'italic 13px "Times New Roman", serif';
        ctx.fillText('y', 31, ly);
      }

      d.ellipses.forEach(function (e) {
        ctx.save();
        ctx.globalAlpha = e.op;
        ctx.strokeStyle = '#007c7a';
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.ellipse(X(e.mu[0]), Y(e.mu[1]), e.r[0] * sx, e.r[1] * sy, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      });

      if (d.method === 'PC-DAPS') {
        D.bag.slice(1).forEach(function (q) { dot(ctx, X(q[0]), Y(q[1]), 3.6, '#ffffff', '#52514e'); });
      }

      var n = d.path.length;
      var prog = clamp(t / RUN, 0, 1);
      var fj = prog * (n - 1);
      var j = Math.floor(fj);
      var head = j >= n - 1 ? d.path[n - 1] : [lerp(d.path[j][0], d.path[j + 1][0], fj - j), lerp(d.path[j][1], d.path[j + 1][1], fj - j)];

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0b0b0b';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(X(d.path[0][0]), Y(d.path[0][1]));
      for (var k = 1; k <= j && k < n; k++) { ctx.lineTo(X(d.path[k][0]), Y(d.path[k][1])); }
      ctx.lineTo(X(head[0]), Y(head[1]));
      ctx.stroke();
      ctx.restore();

      dot(ctx, X(d.path[0][0]), Y(d.path[0][1]), 4, '#0b0b0b', '#ffffff');
      if (prog < 1) {
        dot(ctx, X(head[0]), Y(head[1]), 3.6, '#0b0b0b', '#ffffff');
      } else {
        var pop = clamp((t - RUN) / 260, 0, 1);
        var s = 1 + 0.35 * Math.sin(pop * Math.PI);
        var ex0 = X(d.end[0]);
        var ey0 = Y(d.end[1]);
        if (d.on_prior) {
          dot(ctx, ex0, ey0, 5.6 * s, '#2a78d6', '#ffffff');
        } else {
          var a = 6.6 * s;
          ctx.beginPath();
          ctx.moveTo(ex0, ey0 - a); ctx.lineTo(ex0 + a, ey0); ctx.lineTo(ex0, ey0 + a); ctx.lineTo(ex0 - a, ey0);
          ctx.closePath();
          ctx.fillStyle = '#eb6834';
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      }

      ctx.strokeStyle = '#0b0b0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    }

    function render(t) {
      panels.forEach(function (p) { if (p.data) { drawPanel(p, t); } });
      var done = t >= RUN;
      fig.classList.toggle('is-final', done);
      if (readout) { readout.textContent = 'Langevin step ' + Math.round(clamp(t / RUN, 0, 1) * D.steps) + ' / ' + D.steps; }
    }

    new Timeline({ el: fig, total: total, render: render, controls: controls, reducedAt: total - 1 });
  }

  // -------------------------------------------------------------- outcome chart
  function initOutcomeChart() {
    var root = qs('#outcome-chart');
    if (!root) { return; }
    var names = ['Faithful', 'Upside-down / color-inverted', 'Failed'];
    var classes = ['is-faithful', 'is-inverted', 'is-failed'];
    var segs = [];
    qsa('.outcome-row', root).forEach(function (row) {
      var values = row.dataset.values.split(',').map(Number);
      var bar = qs('.outcome-bar', row);
      var method = qs('.outcome-method', row).textContent.replace(/\s+/g, ' ').trim();
      var dataset = qs('.outcome-dataset', row.parentNode).textContent.trim();
      values.forEach(function (v, i) {
        var seg = document.createElement('span');
        var label = v.toFixed(1) + '%';
        seg.className = 'outcome-seg ' + classes[i];
        seg.dataset.value = String(v);
        seg.title = dataset + ' · ' + method + ' · ' + names[i] + ': ' + v.toFixed(1) + '%';
        seg.setAttribute('role', 'img');
        seg.setAttribute('aria-label', seg.title);
        seg.textContent = label;
        bar.appendChild(seg);
        segs.push(seg);
      });
    });

    function fitLabels() {
      segs.forEach(function (s) {
        s.style.color = '';
        if (s.scrollWidth > s.clientWidth + 1 || s.clientWidth < 26) { s.style.color = 'transparent'; }
      });
    }
    function grow() {
      segs.forEach(function (s) { s.style.flexGrow = s.dataset.value; });
      setTimeout(fitLabels, REDUCED ? 0 : 1050);
    }
    window.addEventListener('resize', function () { setTimeout(fitLabels, 80); });
    if (REDUCED || !HAS_IO) { grow(); return; }
    segs.forEach(function (s) { s.style.color = 'transparent'; });
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { grow(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(root);
  }

  // ---------------------------------------------------------------- gallery tabs
  function initGallery() {
    var tabs = qsa('.gallery-tabs [data-tab]');
    var panels = qsa('.gallery-panel');
    function select(name) {
      tabs.forEach(function (a) {
        var on = a.dataset.tab === name;
        a.parentNode.classList.toggle('is-active', on);
        a.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function (p) { p.classList.toggle('is-active', p.dataset.panel === name); });
    }
    tabs.forEach(function (a) {
      a.setAttribute('tabindex', '0');
      a.addEventListener('click', function (e) { e.preventDefault(); select(a.dataset.tab); });
      a.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(a.dataset.tab); }
      });
    });
  }

  // ------------------------------------------------------------------ lightbox
  function initLightbox() {
    var lightbox = qs('#image-lightbox');
    var stage = qs('#image-lightbox-stage');
    var expanded = qs('#image-lightbox-image');
    var caption = qs('#image-lightbox-caption');
    var zoomOut = qs('#image-lightbox-zoom');
    var images = qsa('.zoomable-image');
    if (!lightbox || !stage || !expanded || !images.length) { return; }
    var btnIn = qs('[data-lightbox-action="zoom-in"]', lightbox);
    var btnOut = qs('[data-lightbox-action="zoom-out"]', lightbox);
    var btnClose = qs('[data-lightbox-action="close"]', lightbox);
    var MIN = 1;
    var MAX = 6;
    var scale = 1;
    var panX = 0;
    var panY = 0;
    var previous = null;
    var pointers = new Map();
    var drag = null;
    var pinch = null;

    function clampPan() {
      var r = stage.getBoundingClientRect();
      var mx = Math.max(0, (expanded.offsetWidth * scale - r.width) / 2);
      var my = Math.max(0, (expanded.offsetHeight * scale - r.height) / 2);
      panX = clamp(panX, -mx, mx);
      panY = clamp(panY, -my, my);
    }
    function view() {
      clampPan();
      expanded.style.transform = 'translate3d(' + panX + 'px, ' + panY + 'px, 0) scale(' + scale + ')';
      zoomOut.textContent = Math.round(scale * 100) + '%';
      btnOut.disabled = scale <= MIN;
      stage.classList.toggle('is-zoomed', scale > MIN);
    }
    function reset() { scale = MIN; panX = 0; panY = 0; view(); }
    function zoom(next, cx, cy) {
      var r = stage.getBoundingClientRect();
      var ns = clamp(next, MIN, MAX);
      var ax = (cx === undefined ? r.left + r.width / 2 : cx) - r.left - r.width / 2;
      var ay = (cy === undefined ? r.top + r.height / 2 : cy) - r.top - r.height / 2;
      panX = ax - (ax - panX) * (ns / scale);
      panY = ay - (ay - panY) * (ns / scale);
      scale = ns;
      if (scale === MIN) { panX = 0; panY = 0; }
      view();
    }
    function open(img) {
      previous = document.activeElement;
      expanded.alt = img.alt || 'Expanded figure';
      caption.textContent = img.alt || '';
      expanded.src = img.currentSrc || img.src;
      lightbox.hidden = false;
      document.body.classList.add('image-lightbox-open');
      reset();
      btnClose.focus();
    }
    function close() {
      if (lightbox.hidden) { return; }
      lightbox.hidden = true;
      document.body.classList.remove('image-lightbox-open');
      expanded.removeAttribute('src');
      pointers.clear();
      drag = null;
      pinch = null;
      if (previous && previous.focus) { previous.focus(); }
    }

    images.forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
      });
    });
    btnIn.addEventListener('click', function () { zoom(scale * 1.3); });
    btnOut.addEventListener('click', function () { zoom(scale / 1.3); });
    btnClose.addEventListener('click', close);
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) { close(); } });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    }, { passive: false });
    stage.addEventListener('dblclick', function (e) { zoom(scale > MIN ? MIN : 2, e.clientX, e.clientY); });
    stage.addEventListener('pointerdown', function (e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, panX: panX, panY: panY };
        stage.classList.add('is-dragging');
      } else if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        var r = stage.getBoundingClientRect();
        var cx = (p[0].x + p[1].x) / 2;
        var cy = (p[0].y + p[1].y) / 2;
        pinch = {
          dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), scale: scale,
          lx: (cx - r.left - r.width / 2 - panX) / scale, ly: (cy - r.top - r.height / 2 - panY) / scale
        };
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) { return; }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        var p = Array.from(pointers.values());
        var r = stage.getBoundingClientRect();
        var cx = (p[0].x + p[1].x) / 2;
        var cy = (p[0].y + p[1].y) / 2;
        scale = clamp(pinch.scale * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / pinch.dist, MIN, MAX);
        panX = cx - r.left - r.width / 2 - pinch.lx * scale;
        panY = cy - r.top - r.height / 2 - pinch.ly * scale;
        view();
      } else if (pointers.size === 1 && drag && scale > MIN) {
        panX = drag.panX + e.clientX - drag.x;
        panY = drag.panY + e.clientY - drag.y;
        view();
      }
    });
    function end(e) {
      pointers.delete(e.pointerId);
      pinch = null;
      if (pointers.size === 1) {
        var q = Array.from(pointers.values())[0];
        drag = { x: q.x, y: q.y, panX: panX, panY: panY };
      } else {
        drag = null;
        stage.classList.remove('is-dragging');
      }
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) { return; }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(scale * 1.3); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoom(scale / 1.3); }
      else if (e.key === '0') { e.preventDefault(); reset(); }
    });
    expanded.addEventListener('load', reset);
    window.addEventListener('resize', view);
  }

  // ---------------------------------------------------------------------- math
  function renderMath() {
    if (typeof window.renderMathInElement !== 'function') { return; }
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  function init() {
    renderMath();
    initTeaser();
    initBestOfK();
    initToyModes();
    initToyLangevin();
    initOutcomeChart();
    initGallery();
    initLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
