// Scroll and ambient motion for Main.dc.html. The page is rendered by the
// DC runtime after load, so everything here discovers elements lazily via a
// MutationObserver and only touches attributes the template doesn't manage.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var root = document.documentElement;
  if (!reduce) root.classList.add('anim');

  var io = !reduce && 'IntersectionObserver' in window
    ? new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
    : null;

  function ms(v) {
    v = (v || '0s').split(',')[0].trim();
    return /ms$/.test(v) ? parseFloat(v) : parseFloat(v) * 1000;
  }
  function delayOf(el) {
    var r = el.closest('.rv');
    var own = parseFloat(el.getAttribute('data-d')) || 0;
    if (r === el) return ms(getComputedStyle(r).transitionDelay);
    return (r ? ms(getComputedStyle(r).transitionDelay) : 0) + own;
  }

  /* ---------- discovery ---------- */

  function scan() {
    each('[data-d]', 'd', function (el) { el.style.setProperty('--d', el.getAttribute('data-d') + 'ms'); });
    each('[data-stagger]', 'stagger', function (p) {
      var name = '--' + (p.getAttribute('data-stagger-var') || 'i');
      if (name === '--i') p.style.setProperty('--st', p.getAttribute('data-stagger') + 'ms');
      for (var k = 0; k < p.children.length; k++) p.children[k].style.setProperty(name, k);
    });
    if (reduce) return;
    each('.rv, .rv-tv, .tag2, [data-draw], [data-count], [data-scramble], [data-glitch]', 'reveal', function (el) {
      if (el.hasAttribute('data-draw')) prepDraw(el);
      if (el.hasAttribute('data-scramble')) el.__text = textOf(el);
      if (!io) return reveal(el);
      // A fully clipped element never reports as intersecting, so watch its parent.
      var t = el.classList.contains('rv-h') ? el.parentElement : el;
      (t.__targets = t.__targets || []).push(el);
      if (watched.indexOf(t) < 0) watched.push(t);
      io.observe(t);
    });
    sweep();
    each('.pupil', 'pupil', trackPupil);
    each('.hero', 'hero', hexGlow);
    each('canvas.swarm', 'swarm', swarm);
  }

  // Runs fn once per element, so rescans after re-renders are cheap.
  function each(sel, key, fn) {
    key = '__m_' + key;
    document.querySelectorAll(sel).forEach(function (el) {
      if (el[key]) return;
      el[key] = true;
      fn(el);
    });
  }

  function onIntersect(entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) fire(e.target);
    });
  }

  function fire(t) {
    io.unobserve(t);
    var k = watched.indexOf(t);
    if (k >= 0) watched.splice(k, 1);
    if (t.isConnected) t.__targets.splice(0).forEach(reveal);
  }

  // IntersectionObserver only reports on rendered frames, so also check
  // geometry directly on load and scroll; content never waits on it.
  var watched = [];
  function sweep() {
    var vh = window.innerHeight;
    watched.slice().forEach(function (t) {
      if (!t.isConnected) return fire(t);
      var r = t.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0 && (r.width || r.height)) fire(t);
    });
  }

  function reveal(el) {
    el.classList.add('is-in');
    if (el.hasAttribute('data-draw')) runDraw(el);
    if (el.hasAttribute('data-count')) countUp(el);
    if (el.hasAttribute('data-scramble')) scramble(el);
    if (el.hasAttribute('data-glitch')) glitch(el);
  }

  function textOf(el) {
    return el.firstChild && el.firstChild.nodeType === 3 && el.childNodes.length === 1 ? el.firstChild : null;
  }

  /* ---------- line drawing ---------- */

  function prepDraw(svg) {
    svg.__shapes = [];
    svg.querySelectorAll('path, polygon, polyline, circle, line, rect, ellipse, text').forEach(function (s) {
      if (s.closest('defs, pattern')) return;
      var cs = getComputedStyle(s);
      var len = s.tagName !== 'text' && cs.stroke !== 'none' && s.getTotalLength ? s.getTotalLength() : 0;
      if (len) {
        s.style.strokeDasharray = len + ' ' + (len + 4);
        s.style.strokeDashoffset = len + 2;
        s.__mode = 'stroke';
      } else {
        s.style.opacity = 0;
        s.__mode = 'fade';
      }
      svg.__shapes.push(s);
    });
  }

  function runDraw(svg) {
    var base = delayOf(svg);
    var dur = parseFloat(svg.getAttribute('data-dur')) || 1200;
    var step = parseFloat(svg.getAttribute('data-step')) || 140;
    var shapes = svg.__shapes || [];
    svg.getBoundingClientRect();
    shapes.forEach(function (s, k) {
      var d = base + k * step;
      if (s.__mode === 'stroke') {
        s.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.6,.1,.2,1) ' + d + 'ms';
        s.style.strokeDashoffset = 0;
      } else {
        s.style.transition = 'opacity 700ms ease ' + (d + dur * 0.4) + 'ms';
        s.style.opacity = '';
      }
    });
    var total = base + Math.max(0, shapes.length - 1) * step + dur;
    setTimeout(function () {
      shapes.forEach(function (s) {
        s.style.transition = s.style.strokeDasharray = s.style.strokeDashoffset = '';
      });
      svg.classList.add('alive');
    }, total + 50);
  }

  /* ---------- text effects ---------- */

  function countUp(el) {
    var node = textOf(el);
    if (!node) return;
    var target = node.nodeValue;
    var end = parseFloat(target);
    var dec = (target.split('.')[1] || '').length;
    var t0 = performance.now() + delayOf(el) + 200;
    node.nodeValue = (0).toFixed(dec);
    (function tick(now) {
      var p = Math.min(1, Math.max(0, (now - t0) / 1600));
      var e = 1 - Math.pow(1 - p, 3);
      node.nodeValue = p >= 1 ? target : (end * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

  var GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#/%<>';
  function scramble(el) {
    var node = el.__text;
    if (!node) return;
    var final = node.nodeValue;
    var rand = function () { return GLYPHS[(Math.random() * GLYPHS.length) | 0]; };
    var mix = function (n) {
      var out = '';
      for (var i = 0; i < final.length; i++) {
        var c = final[i];
        out += i < n || c === ' ' || c === '·' || c === '/' ? c : rand();
      }
      return out;
    };
    node.nodeValue = mix(0);
    var t0 = performance.now() + delayOf(el);
    var dur = Math.min(1100, 300 + final.length * 22);
    (function tick(now) {
      var p = (now - t0) / dur;
      if (p >= 1) { node.nodeValue = final; return; }
      if (p >= 0) node.nodeValue = mix(Math.floor(p * final.length));
      setTimeout(function () { requestAnimationFrame(tick); }, 40);
    })(performance.now());
  }

  // The Architect's report briefly shows the real number of missing residents.
  function glitch(el) {
    var node = textOf(el);
    if (!node) return;
    var real = node.nodeValue, alt = el.getAttribute('data-glitch');
    function flick() {
      if (!el.isConnected) return;
      var seq = [[alt, 0], [real, 110], [alt, 190], [real, 330]];
      seq.forEach(function (s) {
        setTimeout(function () {
          node.nodeValue = s[0];
          el.classList.toggle('glitching', s[0] === alt);
        }, s[1]);
      });
      setTimeout(flick, 4500 + Math.random() * 4000);
    }
    setTimeout(flick, delayOf(el) + 1400);
  }

  /* ---------- the Architect's eye ---------- */

  function trackPupil(pupil) {
    var svg = pupil.ownerSVGElement;
    var last = 0, x = 0, y = 0;
    function look(tx, ty) {
      x = tx; y = ty;
      pupil.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
    }
    window.addEventListener('pointermove', function (e) {
      if (!svg.classList.contains('alive')) return;
      last = Date.now();
      var r = svg.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.54);
      var dist = Math.hypot(dx, dy) || 1;
      var k = Math.min(1, dist / 300) * 9;
      pupil.style.transition = 'transform .25s ease-out';
      look(dx / dist * k, dy / dist * k * 0.6);
    }, { passive: true });
    setInterval(function () {
      if (!svg.classList.contains('alive') || Date.now() - last < 3000) return;
      var a = Math.random() * Math.PI * 2, m = Math.random() * 8;
      pupil.style.transition = 'transform .6s cubic-bezier(.3,.7,.2,1)';
      look(Math.cos(a) * m, Math.sin(a) * m * 0.6);
    }, 2200);
  }

  function hexGlow(section) {
    if (!finePointer) return;
    section.addEventListener('pointermove', function (e) {
      var r = section.getBoundingClientRect();
      section.style.setProperty('--mx', e.clientX - r.left + 'px');
      section.style.setProperty('--my', e.clientY - r.top + 'px');
    });
    section.addEventListener('pointerleave', function () {
      section.style.setProperty('--mx', '-999px');
    });
  }

  document.addEventListener('pointermove', function (e) {
    var card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    var r = card.getBoundingClientRect();
    card.style.setProperty('--cx', e.clientX - r.left + 'px');
    card.style.setProperty('--cy', e.clientY - r.top + 'px');
  }, { passive: true });

  /* ---------- the swarm leaving the hive ---------- */

  function swarm(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, bees = [], running = false, prev = 0;
    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = w < 700 ? 26 : 54;
      while (bees.length < n) bees.push(spawn(true));
      bees.length = n;
    }
    function spawn(anywhere) {
      return {
        x: w / 2 + (Math.random() - 0.5) * w * 0.95,
        y: anywhere ? Math.random() * h : h + 10 + Math.random() * 60,
        vy: 0.35 + Math.random() * 0.75,
        amp: 0.4 + Math.random() * 1.1,
        freq: 1.5 + Math.random() * 2.5,
        ph: Math.random() * 6.28,
        r: 1.1 + Math.random() * 1.3
      };
    }
    function frame(now) {
      if (!running) return;
      var dt = Math.min(3, (now - prev) / 16.67 || 1);
      prev = now;
      var t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < bees.length; i++) {
        var b = bees[i];
        b.y -= b.vy * dt;
        b.x += (Math.sin(t * b.freq + b.ph) * b.amp + (w / 2 - b.x) * 0.0015) * dt;
        if (b.y < -12) bees[i] = b = spawn(false);
        var edge = Math.min(1, b.y / (h * 0.25), (h - b.y) / (h * 0.15));
        var a = Math.max(0, edge);
        var flap = Math.sin(t * 60 + b.ph) > 0 ? 1 : 0.4;
        ctx.fillStyle = 'rgba(232,163,58,' + (0.12 * a).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 3.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(241,230,207,' + (0.3 * a * flap).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(b.x - b.r, b.y - b.r * 0.7, b.r * 0.9, b.r * 0.5, -0.5, 0, 6.283);
        ctx.ellipse(b.x + b.r, b.y - b.r * 0.7, b.r * 0.9, b.r * 0.5, 0.5, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = 'rgba(232,163,58,' + (0.85 * a).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    size();
    window.addEventListener('resize', size);
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !running) { running = true; prev = performance.now(); requestAnimationFrame(frame); }
      running = vis;
    }).observe(canvas);
  }

  /* ---------- scroll-linked: ascent meter, parallax, quote, nav ---------- */

  var ticking = false;
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function update() {
    ticking = false;
    if (io) sweep();
    var y = window.scrollY, vh = window.innerHeight;
    var max = Math.max(1, document.documentElement.scrollHeight - vh);
    var p = Math.min(1, y / max);

    var header = document.querySelector('.site-header');
    if (header) header.classList.toggle('is-scrolled', y > 8);

    var finale = document.querySelector('.finale');
    var reset = !!finale && finale.getBoundingClientRect().top < vh * 0.45;
    var hud = document.querySelector('.hud'), bar = document.querySelector('.hud-bar');
    if (hud && bar) {
      hud.classList.toggle('is-on', y > vh * 0.5);
      hud.classList.toggle('is-reset', reset);
      bar.classList.toggle('is-reset', reset);
      var v = hud.querySelector('.hud-v'), d = hud.querySelector('.hud-d');
      var fill = bar.firstElementChild;
      if (reset) {
        v.textContent = '00.0%';
        d.textContent = 'Index reset · back to work';
        fill.style.transform = 'scaleX(0)';
      } else {
        var idx = p * 100;
        v.textContent = (idx < 10 ? '0' : '') + idx.toFixed(1) + '%';
        d.textContent = Math.round(400 * (1 - p)) + ' m below';
        fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      }
    }

    if (!reduce) {
      document.querySelectorAll('[data-parallax]').forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var off = Math.max(-120, Math.min(120, -r.top * parseFloat(el.getAttribute('data-parallax'))));
        el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
      });
      var quote = document.querySelector('.quote');
      if (quote) {
        var qr = quote.getBoundingClientRect();
        var qp = Math.min(1, Math.max(0, (vh * 0.88 - qr.top) / (vh * 0.45)));
        var words = quote.querySelectorAll('.w');
        words.forEach(function (w, k) { w.classList.toggle('lit', qp > 0 && k < qp * words.length + 0.5); });
      }
    }

    var current = null;
    document.querySelectorAll('section[id]').forEach(function (s) {
      if (s.getBoundingClientRect().top <= vh * 0.35) current = s.id;
    });
    document.querySelectorAll('.navlink').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });
  }

  /* ---------- boot ---------- */

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    // A timer rather than rAF: rAF is paused in background tabs, which would
    // leave content hidden until the tab is focused.
    setTimeout(function () { pending = false; scan(); update(); }, 30);
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  schedule();
})();
