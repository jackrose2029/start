/* =====================================================================
   MOBILE MODE  v1.0   (shared by the JORJ games; no dependencies)
   - "Mobile Mode" button on the first screen. Default = current (standard) mode.
   - Mobile mode: virtual gamepad (stick + buttons) that sends real keyboard events,
     touch gestures on the play area, adjustable opacity / size, left-hand swap.
   - The pad lives in reserved screen space (side gutters in landscape, a bottom
     dock in portrait) and the game canvas is fitted into what is left, so the
     controls never cover the play area.
   Usage:  MobileMode.init({ id, canvas, aspect, playing, pad, gestures, css })
   ===================================================================== */
(function () {
  'use strict';
  if (window.MobileMode) return;

  var KEY = 'mm:v1';
  var DEF = { on: false, pad: true, opacity: 0.55, size: 1, gestures: true, left: false, haptics: true };
  var S = Object.assign({}, DEF);
  try { var raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && typeof raw === 'object') for (var k in DEF) if (typeof raw[k] === typeof DEF[k]) S[k] = raw[k]; } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

  /* ---------- key table ---------- */
  var KC = {
    Space: { key: ' ', code: 'Space', kc: 32 }, Enter: { key: 'Enter', code: 'Enter', kc: 13 }, Escape: { key: 'Escape', code: 'Escape', kc: 27 },
    Tab: { key: 'Tab', code: 'Tab', kc: 9 }, Backspace: { key: 'Backspace', code: 'Backspace', kc: 8 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', kc: 37 }, ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', kc: 38 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', kc: 39 }, ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', kc: 40 },
    ShiftLeft: { key: 'Shift', code: 'ShiftLeft', kc: 16 }, ControlLeft: { key: 'Control', code: 'ControlLeft', kc: 17 }
  };
  function K(n) {
    if (KC[n]) return KC[n];
    var m = /^Key([A-Z])$/.exec(n); if (m) return (KC[n] = { key: m[1].toLowerCase(), code: n, kc: m[1].charCodeAt(0) });
    m = /^Digit(\d)$/.exec(n); if (m) return (KC[n] = { key: m[1], code: n, kc: 48 + +m[1] });
    return (KC[n] = { key: n, code: n, kc: 0 });
  }

  var cfg = null, canvas = null, root, chip, panel, toastEl, styleEl;
  var held = {};            // code -> refcount
  var repeaters = {};       // code -> timer ids
  function target() { return canvas || document.body; }
  function fire(type, k, repeat) {
    var init = { key: k.key, code: k.code, keyCode: k.kc, which: k.kc, bubbles: true, cancelable: true, repeat: !!repeat, shiftKey: k.code === 'ShiftLeft' };
    var e = new KeyboardEvent(type, init);
    try { if (e.keyCode !== k.kc) { Object.defineProperty(e, 'keyCode', { get: function () { return k.kc; } }); Object.defineProperty(e, 'which', { get: function () { return k.kc; } }); } } catch (er) { }
    target().dispatchEvent(e);
  }
  function isPlaying() { try { return cfg && cfg.playing ? !!cfg.playing() : false; } catch (e) { return false; } }
  function down(name, menuRepeat) {
    if (!name) return; var k = K(name);
    held[name] = (held[name] || 0) + 1;
    if (held[name] === 1) {
      fire('keydown', k, false);
      if (menuRepeat) {
        var t0 = setTimeout(function () {
          var iv = setInterval(function () { if (!held[name]) { clearInterval(iv); return; } if (isPlaying()) return; fire('keydown', k, true); }, 110);
          repeaters[name] = { iv: iv };
        }, 380);
        repeaters[name] = { t0: t0 };
      }
    }
  }
  function up(name) {
    if (!name || !held[name]) return; held[name]--;
    if (held[name] === 0) {
      delete held[name]; var r = repeaters[name]; if (r) { clearTimeout(r.t0); clearInterval(r.iv); delete repeaters[name]; }
      fire('keyup', K(name), false);
    }
  }
  function tap(name, ms) { if (!name) return; down(name); setTimeout(function () { up(name); }, ms || 70); }
  function releaseAll() { for (var n in held) { var c = held[n]; while (c-- > 0) up(n); } }
  function buzz(n) { if (S.haptics && navigator.vibrate) { try { navigator.vibrate(n || 8); } catch (e) { } } }

  /* ---------- css ---------- */
  var CSS = [
    '.mm-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none}',
    '.mm-root[hidden]{display:none}',
    '.mm-pad{position:absolute;inset:0;opacity:var(--mm-op,.55);pointer-events:none}',
    '.mm-pad[hidden]{display:none}',
    '.mm-b,.mm-sys{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;border-radius:50%;box-sizing:border-box;',
    ' background:rgba(24,24,30,.78);border:2px solid rgba(255,255,255,.55);color:#fff;font-weight:800;line-height:1;text-align:center;-webkit-tap-highlight-color:transparent}',
    '.mm-b.on,.mm-sys.on{background:rgba(255,255,255,.88);color:#111}',
    '.mm-b small{display:block;font-size:.5em;font-weight:700;opacity:.85;margin-top:2px;letter-spacing:.02em}',
    '.mm-sys{border-radius:12px}',
    '.mm-stick{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;background:rgba(24,24,30,.55);border:2px solid rgba(255,255,255,.5)}',
    '.mm-stick i{position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;background:rgba(255,255,255,.8);border:2px solid rgba(0,0,0,.35);box-shadow:0 2px 6px rgba(0,0,0,.4)}',
    '.mm-stick b{position:absolute;color:rgba(255,255,255,.75);font-size:12px;font-weight:900}',
    '.mm-chip{position:fixed;z-index:2147483100;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);padding:9px 16px;border-radius:22px;border:2px solid rgba(255,255,255,.8);',
    ' background:rgba(20,20,28,.88);color:#fff;font:800 14px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;display:none;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,.5);touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.mm-chip.show{display:block}.mm-chip.on{background:rgba(255,255,255,.92);color:#111;border-color:#111}',
    '.mm-toast{position:fixed;z-index:2147483200;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);transform:translateX(-50%);max-width:90vw;background:rgba(0,0,0,.85);color:#fff;padding:9px 16px;border-radius:16px;font:700 13px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .25s;text-align:center}',
    '.mm-toast.show{opacity:1}',
    '.mm-panel{position:fixed;z-index:2147483300;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);touch-action:manipulation}',
    '.mm-panel.show{display:flex}',
    '.mm-box{width:min(420px,92vw);max-height:92vh;overflow:auto;background:#17171f;color:#f2f2f5;border:1px solid #3a3a48;border-radius:16px;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.6);font:600 15px system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.mm-box h2{margin:0 0 10px;font-size:19px}',
    '.mm-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #2a2a36}',
    '.mm-row:first-of-type{border-top:0}',
    '.mm-row label{flex:1}',
    '.mm-row small{display:block;color:#9a9aaa;font-weight:500;font-size:12px;margin-top:2px}',
    '.mm-seg{display:flex;border:1px solid #555;border-radius:10px;overflow:hidden}',
    '.mm-seg button{border:0;background:#22222c;color:#ddd;padding:9px 12px;font:700 13px system-ui,sans-serif;min-height:40px}',
    '.mm-seg button.sel{background:#f2f2f5;color:#111}',
    '.mm-box input[type=range]{width:150px;height:30px}',
    '.mm-sw{width:50px;height:30px;border-radius:15px;border:0;background:#3a3a48;position:relative;flex:none}',
    '.mm-sw:after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:left .15s}',
    '.mm-sw.on{background:#3fae6a}.mm-sw.on:after{left:23px}',
    '.mm-act{display:flex;gap:8px;margin-top:12px}',
    '.mm-act button{flex:1;min-height:44px;border-radius:10px;border:1px solid #555;background:#22222c;color:#fff;font:800 14px system-ui,sans-serif}',
    '.mm-act button.pri{background:#f2f2f5;color:#111;border-color:#f2f2f5}',
    /* the canvas is fitted into the area the pad leaves free */
    'html.mm-on,html.mm-on body{overflow:hidden!important;overscroll-behavior:none;touch-action:none}',
    'html.mm-on canvas.mm-canvas{position:fixed!important;left:var(--mm-x)!important;top:var(--mm-y)!important;width:var(--mm-w)!important;height:var(--mm-h)!important;max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;aspect-ratio:auto!important}',
    'html.mm-on #rotate{display:none!important}'
  ].join('\n');

  /* ---------- helpers ---------- */
  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('show'); }, 2200); }
  function safe() {
    var p = el('div', '', document.body); p.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    var cs = getComputedStyle(p), r = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    p.remove(); return r;
  }

  /* ---------- pad construction ---------- */
  var stickEl, knobEl, btnEls = [], sysEls = [], padEl;
  var stickState = { id: null, cx: 0, cy: 0, r: 1, dirs: {} };

  function bindHold(node, def) {
    var active = null;
    node.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation(); if (active != null) return; active = e.pointerId;
      try { node.setPointerCapture(e.pointerId); } catch (er) { }
      node.classList.add('on'); buzz(10);
      if (def.hold === false) { tap(def.key, 80); } else down(def.key);
      if (def.also) tap(def.also, 80);
    });
    function end(e) { if (e.pointerId !== active) return; active = null; node.classList.remove('on'); if (def.hold !== false) up(def.key); }
    node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end); node.addEventListener('lostpointercapture', end);
  }

  function buildPad() {
    padEl = el('div', 'mm-pad', root);
    var p = cfg.pad || {};
    // stick
    var sk = p.stick;
    if (sk) {
      stickEl = el('div', 'mm-stick', padEl); knobEl = el('i', '', stickEl);
      stickEl.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation(); if (stickState.id != null) return; stickState.id = e.pointerId;
        try { stickEl.setPointerCapture(e.pointerId); } catch (er) { } buzz(8); stickMove(e);
      });
      stickEl.addEventListener('pointermove', function (e) { if (e.pointerId === stickState.id) stickMove(e); });
      var se = function (e) { if (e.pointerId !== stickState.id) return; stickState.id = null; setDirs({}); knobEl.style.transform = ''; };
      stickEl.addEventListener('pointerup', se); stickEl.addEventListener('pointercancel', se); stickEl.addEventListener('lostpointercapture', se);
    }
    (p.buttons || []).forEach(function (b) {
      var n = el('div', 'mm-b', padEl, '<span>' + b.label + (b.sub ? '<small>' + b.sub + '</small>' : '') + '</span>'); bindHold(n, b); btnEls.push({ n: n, def: b });
    });
    (p.sys || []).forEach(function (b) {
      var n = el('div', 'mm-sys', root, b.label); bindHold(n, b); sysEls.push({ n: n, def: b });
    });
    // settings gear (always present in mobile mode)
    var g = el('div', 'mm-sys', root, '⚙'); g.setAttribute('aria-label', 'Mobile mode settings');
    g.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); openPanel(); });
    sysEls.push({ n: g, def: { gear: true } });
  }

  function setDirs(d) {
    var map = (cfg.pad && cfg.pad.stick) || {}, menu = !isPlaying();
    ['left', 'right', 'up', 'down'].forEach(function (k) {
      if (d[k] && !stickState.dirs[k]) down(map[k], menu);
      if (!d[k] && stickState.dirs[k]) up(map[k]);
    });
    stickState.dirs = d;
  }
  function stickMove(e) {
    var r = stickEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    var dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy) || 1, lim = R * 0.62;
    var kx = m > lim ? dx / m * lim : dx, ky = m > lim ? dy / m * lim : dy;
    knobEl.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
    var dz = R * 0.26, d = {};
    if (m > dz) {
      var ax = Math.abs(dx), ay = Math.abs(dy), dm = (cfg.pad.stick.diag === false);
      if (dm) { if (ax >= ay) d[dx < 0 ? 'left' : 'right'] = 1; else d[dy < 0 ? 'up' : 'down'] = 1; }
      else { if (ax > dz * 0.9 && ax > ay * 0.42) d[dx < 0 ? 'left' : 'right'] = 1; if (ay > dz * 0.9 && ay > ax * 0.42) d[dy < 0 ? 'up' : 'down'] = 1; }
    }
    setDirs(d);
  }

  /* ---------- layout ---------- */
  var geo = { land: true };
  function fsK(t, base) { var n = String(t).length; return n <= 1 ? base * 1.3 : n <= 3 ? base : n === 4 ? base * 0.76 : base * 0.64; }
  function layout() {
    var html = document.documentElement;
    if (!S.on) { html.classList.remove('mm-on'); if (canvas) canvas.classList.remove('mm-canvas'); root.hidden = true; return; }
    html.classList.add('mm-on'); if (canvas) canvas.classList.add('mm-canvas'); root.hidden = false;
    var vw = window.innerWidth, vh = window.innerHeight, sa = safe(), land = vw > vh, pad = S.pad;
    geo.land = land;
    padEl.hidden = !pad; root.style.setProperty('--mm-op', S.opacity);
    var gw = 0, gh = 0;
    if (pad) { if (land) gw = clamp(vw * 0.17, 104, 168); else gh = clamp(vh * 0.36, 210, 300); }
    var rx = sa.l + gw, ry = sa.t, rw = vw - sa.l - sa.r - 2 * gw, rh = vh - sa.t - sa.b - gh;
    var ar = cfg.aspect || ((canvas && canvas.width && canvas.height) ? canvas.width / canvas.height : 16 / 9);
    var w = Math.min(rw, rh * ar), h = w / ar;
    var x = rx + (rw - w) / 2, y = ry + (rh - h) / (land ? 2 : 3);
    var st = document.documentElement.style;
    st.setProperty('--mm-x', Math.round(x) + 'px'); st.setProperty('--mm-y', Math.round(y) + 'px'); st.setProperty('--mm-w', Math.floor(w) + 'px'); st.setProperty('--mm-h', Math.floor(h) + 'px');

    // the gear is the last system button; the others come from config
    var sysN = sysEls.length, sysSize = 38;
    function place(n, px, py, w2, h2) { n.style.left = Math.round(px) + 'px'; n.style.top = Math.round(py) + 'px'; n.style.width = Math.round(w2) + 'px'; n.style.height = Math.round(h2 || w2) + 'px'; }
    var swap = S.left;
    if (pad) {
      var sx, sy, R, cx0, cy0, u, areaW, areaH, top0;
      if (land) {
        areaW = gw - 8; areaH = vh - sa.t - sa.b;
        R = Math.min(areaW / 2, 74 * S.size + 6); R = Math.max(46, R);
        var leftX = sa.l + gw / 2, rightX = vw - sa.r - gw / 2;
        sx = (swap ? rightX : leftX); cx0 = (swap ? leftX : rightX);
        sy = vh - sa.b - R - 14;
        u = Math.min(46 * S.size, (areaW - 6) / 3.7); u = Math.max(30, u);
        cy0 = vh - sa.b - (u * 3.6) / 2 - 16; top0 = cy0;
      } else {
        areaW = vw / 2 - 12; areaH = gh - 46;
        R = Math.min(areaW / 2, 66 * S.size + 6, areaH / 2 - 6); R = Math.max(44, R);
        var lX = sa.l + R + 14, rX = vw - sa.r - areaW / 2 - 6;
        sx = swap ? vw - sa.r - R - 14 : lX; cx0 = swap ? sa.l + areaW / 2 + 6 : rX;
        sy = vh - sa.b - R - 12;
        u = Math.min(46 * S.size, (areaW - 6) / 3.7, (areaH - 8) / 4.9); u = Math.max(28, u);
        cy0 = vh - sa.b - (u * 3.6) / 2 - 14; top0 = cy0;
      }
      if (stickEl) { stickEl.style.display = ''; place(stickEl, sx - R, sy - R, R * 2, R * 2); }
      var d = u * 1.08, bd = u * 1.5, sm = u * 1.0;
      var slot = { a: [0, d], b: [d, 0], x: [-d, 0], y: [0, -d] };
      var smalls = [];
      btnEls.forEach(function (o) {
        var s = slot[o.def.slot || 'a'];
        if (o.def.small) { smalls.push(o); return; }
        if (!s) s = [0, 0];
        place(o.n, cx0 + s[0] - bd / 2, cy0 + s[1] - bd / 2, bd); o.n.style.fontSize = Math.round(bd * fsK(o.def.label, 0.3)) + 'px'; o.n.style.display = '';
      });
      // small shoulder-style buttons in a row above the diamond
      var rowY = cy0 - d - bd / 2 - sm - 6, per = Math.max(1, Math.floor((u * 3.7) / (sm + 6)));
      smalls.forEach(function (o, i) {
        var col = i % per, row = Math.floor(i / per), cnt = Math.min(per, smalls.length - row * per);
        var px = cx0 - (cnt * (sm + 6) - 6) / 2 + col * (sm + 6);
        place(o.n, px, rowY - row * (sm + 6), sm); o.n.style.fontSize = Math.round(sm * fsK(o.def.label, 0.34)) + 'px'; o.n.style.display = '';
      });
      // system buttons (pause, OK ...) + gear
      var sys = sysEls.slice(); sysN = sys.length;
      if (land) {
        // gear top of the stick gutter, the rest top of the button gutter
        var gearX = swap ? vw - sa.r - gw / 2 - sysSize / 2 : sa.l + gw / 2 - sysSize / 2;
        var oX = swap ? sa.l + 8 : vw - sa.r - gw + 8;
        var gear = sys.filter(function (o) { return o.def.gear; })[0], others = sys.filter(function (o) { return !o.def.gear; });
        if (gear) { place(gear.n, gearX, sa.t + 8, sysSize); gear.n.style.fontSize = '20px'; }
        others.forEach(function (o, i) { var ww = Math.min(gw - 16, 56), col = i % 2, row = Math.floor(i / 2); place(o.n, oX + col * (ww + 4), sa.t + 8 + row * 42, ww, sysSize); o.n.style.fontSize = '14px'; });
      } else {
        var rowT = vh - sa.b - gh + 6, sw = Math.min(56, (vw - 24) / sysN - 6), tot = sysN * (sw + 6) - 6, sx0 = (vw - tot) / 2;
        sys.forEach(function (o, i) { place(o.n, sx0 + i * (sw + 6), rowT, sw, sysSize); o.n.style.fontSize = o.def.gear ? '20px' : '14px'; });
      }
    } else {
      if (stickEl) stickEl.style.display = 'none';
      btnEls.forEach(function (o) { o.n.style.display = 'none'; });
      // pad hidden: only a small gear (and pause) sit in the top corners
      sysEls.forEach(function (o) { o.n.style.display = ''; });
      var gearO = sysEls.filter(function (o) { return o.def.gear; })[0], oth = sysEls.filter(function (o) { return !o.def.gear; });
      if (gearO) { place(gearO.n, sa.l + 6, sa.t + 6, 34); gearO.n.style.fontSize = '18px'; }
      oth.forEach(function (o, i) { place(o.n, vw - sa.r - 6 - (i + 1) * 40, sa.t + 6, 34); o.n.style.fontSize = '12px'; });
    }
    // system buttons sit in .mm-root, not in .mm-pad, so they follow the pad opacity separately
    sysEls.forEach(function (o) { o.n.style.opacity = S.pad ? S.opacity : Math.min(S.opacity, 0.6); o.n.style.display = ''; });
  }

  /* ---------- gestures on the play area ---------- */
  var gp = {};   // pointerId -> state
  function gcfg() { return (S.on && S.gestures && cfg.gestures) || null; }
  function onGDown(e) {
    var g = gcfg(); if (!g || !canvas) return;
    if (e.pointerType === 'mouse') return;
    if (e.target !== canvas) return;
    var n = Object.keys(gp).length;
    var s = { x: e.clientX, y: e.clientY, t: performance.now(), keys: {}, moved: 0, multi: n > 0 };
    gp[e.pointerId] = s;
    if (n > 0) for (var id in gp) gp[id].multi = true;
  }
  function gHold(s, dx, dy) {
    var g = gcfg(); if (!g || !g.hold) return;
    var T = Math.max(14, Math.min(window.innerWidth, window.innerHeight) * 0.035), want = {};
    if (!isPlaying()) { return; }   // menus: the swipes below navigate instead
    if (g.hold.left && dx < -T) want.left = 1; if (g.hold.right && dx > T) want.right = 1;
    if (g.hold.up && dy < -T) want.up = 1; if (g.hold.down && dy > T) want.down = 1;
    if (g.hold.diag === false && want.left | want.right && (want.up | want.down)) { if (Math.abs(dx) >= Math.abs(dy)) { delete want.up; delete want.down; } else { delete want.left; delete want.right; } }
    ['left', 'right', 'up', 'down'].forEach(function (k) {
      if (want[k] && !s.keys[k]) { down(g.hold[k]); s.keys[k] = 1; }
      if (!want[k] && s.keys[k]) { up(g.hold[k]); delete s.keys[k]; }
    });
  }
  function onGMove(e) {
    var s = gp[e.pointerId]; if (!s) return;
    var dx = e.clientX - s.x, dy = e.clientY - s.y; s.moved = Math.max(s.moved, Math.hypot(dx, dy)); s.dx = dx; s.dy = dy;
    if (!s.multi) gHold(s, dx, dy);
  }
  function onGUp(e) {
    var s = gp[e.pointerId]; if (!s) return; delete gp[e.pointerId];
    var g = gcfg(); var dt = performance.now() - s.t;
    for (var k in s.keys) up(g && g.hold && g.hold[k]);
    if (!g) return;
    var dx = (e.clientX - s.x), dy = (e.clientY - s.y), dist = Math.hypot(dx, dy);
    if (s.multi) {
      if (dt < 350 && s.moved < 14 && g.twoFinger && Object.keys(gp).length === 0) { tap(g.twoFinger, 80); buzz(12); }
      return;
    }
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    var fastFlick = dt < 280 && dist > Math.max(34, Math.min(window.innerWidth, window.innerHeight) * 0.08);
    if (!isPlaying()) {
      // menus: swipes move the cursor
      if (g.menuSwipe !== false && dist > 36 && dt < 600) { var mk = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[dir]; tap(mk, 60); }
      return;
    }
    if (fastFlick && g.flick && g.flick[dir]) { tap(g.flick[dir], 90); buzz(10); return; }
    if (dt < 260 && s.moved < 12 && g.tap) { tap(g.tap, 90); buzz(8); }
  }

  /* ---------- panel ---------- */
  function openPanel() { buildPanel(); panel.classList.add('show'); }
  function closePanel() { panel.classList.remove('show'); }
  function buildPanel() {
    panel.innerHTML = ''; var box = el('div', 'mm-box', panel); el('h2', '', box, '📱 Mobile Mode');
    function row(label, sub) { var r = el('div', 'mm-row', box); var l = el('label', '', r, label + (sub ? '<small>' + sub + '</small>' : '')); return r; }
    var r1 = row('Mode', 'Standard keeps the game exactly as it is.');
    var seg = el('div', 'mm-seg', r1); ['Standard', 'Mobile'].forEach(function (t, i) {
      var b = el('button', (S.on === (i === 1)) ? 'sel' : '', seg, t); b.onclick = function () { setOn(i === 1); buildPanel(); };
    });
    function sw(label, sub, key) { var r = row(label, sub); var b = el('button', 'mm-sw' + (S[key] ? ' on' : ''), r); b.setAttribute('aria-label', label); b.onclick = function () { S[key] = !S[key]; save(); apply(); b.classList.toggle('on', S[key]); }; }
    function rng(label, sub, key, min, max, step, fmt) {
      var r = row(label, sub), w = el('div', '', r), inp = el('input', '', w); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = S[key];
      var v = el('small', '', w, fmt(S[key])); v.style.textAlign = 'right';
      inp.oninput = function () { S[key] = parseFloat(inp.value); v.textContent = fmt(S[key]); apply(); }; inp.onchange = function () { save(); };
    }
    sw('Virtual gamepad', 'Stick and buttons in the screen margins.', 'pad');
    rng('Gamepad opacity', 'Lower = more see-through.', 'opacity', 0.1, 1, 0.05, function (v) { return Math.round(v * 100) + '%'; });
    rng('Button size', '', 'size', 0.7, 1.4, 0.05, function (v) { return Math.round(v * 100) + '%'; });
    sw('Touch gestures', cfg.gestureHelp || 'Drag, flick and tap on the play area.', 'gestures');
    sw('Left-handed layout', 'Swap stick and buttons.', 'left');
    sw('Vibration', 'Small buzz on button presses.', 'haptics');
    var a = el('div', 'mm-act', box);
    if (document.documentElement.requestFullscreen) { var f = el('button', '', a, 'Fullscreen'); f.onclick = function () { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { } }; }
    var c = el('button', 'pri', a, 'Done'); c.onclick = closePanel;
    panel.onclick = function (e) { if (e.target === panel) closePanel(); };
  }

  /* ---------- state ---------- */
  function apply() { layout(); updateChip(); }
  function setOn(v) {
    v = !!v; if (v === S.on) return; S.on = v; save(); releaseAll();
    window.MobileMode.on = v; apply();
    try { window.dispatchEvent(new Event('resize')); } catch (e) { }
    if (cfg.onChange) { try { cfg.onChange(v); } catch (e) { } }
    toast(v ? 'Mobile mode on. Tap ⚙ for settings.' : 'Standard mode.');
  }
  function updateChip() {
    var show = !isPlaying() && !panel.classList.contains('show');
    chip.classList.toggle('show', show); chip.classList.toggle('on', S.on);
    chip.textContent = S.on ? '📱 Mobile Mode · On  ⚙' : '📱 Mobile Mode';
  }

  function init(c) {
    cfg = c || {};
    canvas = typeof cfg.canvas === 'string' ? document.querySelector(cfg.canvas) : cfg.canvas;
    styleEl = el('style', '', document.head); styleEl.textContent = CSS + (cfg.css ? '\n' + cfg.css : '');
    root = el('div', 'mm-root', document.body); root.hidden = true;
    chip = el('button', 'mm-chip', document.body); toastEl = el('div', 'mm-toast', document.body); panel = el('div', 'mm-panel', document.body);
    buildPad();
    chip.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    chip.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (S.on) openPanel(); else setOn(true); });
    window.addEventListener('pointerdown', onGDown, { capture: true, passive: true });
    window.addEventListener('pointermove', onGMove, { passive: true });
    window.addEventListener('pointerup', onGUp, true); window.addEventListener('pointercancel', onGUp, true);
    window.addEventListener('resize', function () { apply(); }); window.addEventListener('orientationchange', function () { setTimeout(apply, 250); });
    window.addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
    window.MobileMode.on = S.on; window.MobileMode.settings = S;
    apply(); setInterval(updateChip, 350);
  }

  window.MobileMode = { init: init, on: S.on, settings: S, setOn: setOn, refresh: apply, openSettings: function () { openPanel(); }, version: '1.0' };
})();
