/**
 * Kleurlab — live afstemmen van het clubrood.
 *
 * Alle rode oppervlakken in de site lopen via de tokens --color-club-50..900
 * (zie src/styles/global.css). Dit paneel herrekent die tien tokens en zet ze
 * als inline stijl op <html>, zodat de hele site meteen meekleurt.
 *
 * De ramp wordt in OKLCH opgebouwd uit één sjabloon: per stap een vaste
 * lichtheid en een chroma-verhouding tegenover club-500. Drie knoppen sturen
 * die ramp: tint (hoek), felheid (chroma-factor) en diepte (lichtheid).
 * Met felheid 1 / diepte 0 / tint 0 komen er exact de huidige hexcodes uit —
 * "Huidig" is dus geen benadering maar de echte huisstijl.
 *
 * Wordt alleen geladen wanneer het lab aanstaat (?kleurlab in de URL, of eerder
 * geactiveerd); zie src/components/ColorLab.astro.
 */
(function () {
  'use strict';

  // [stap, lichtheid, chroma tegenover club-500, tintdrift in graden]
  var TEMPLATE = [
    [50, 0.967, 0.063, -3.1],
    [100, 0.9252, 0.15, -2.2],
    [200, 0.845, 0.326, -2.2],
    [300, 0.7592, 0.544, -2.7],
    [400, 0.6817, 0.793, -0.6],
    [500, 0.6232, 1.0, 0],
    [600, 0.5623, 0.94, -0.1],
    [700, 0.4791, 0.791, -0.2],
    [800, 0.3904, 0.629, -0.2],
    [900, 0.2985, 0.461, -0.3],
  ];
  var BASE_CHROMA = 0.2116;
  var BASE_HUE = 31.96;

  /**
   * Alle presets houden diepte op 0. Sinds witte tekst op club-600 staat en
   * donkere tekst op club-500 (de twee-roden-regel in DESIGN.md) is diepte niet
   * meer nodig om contrast te halen — en breekt ze juist iets: een donkerder
   * club-500 zakt onder 4,5:1 voor de inkt-tekst op het rode veerpaneel.
   * Felheid mag daarentegen de hele weg naar 62% zonder één meting te breken.
   */
  var PRESETS = [
    { name: 'Huidig', hue: 0, vividness: 1.0, depth: 0 },
    { name: 'Iets zachter', hue: 0, vividness: 0.9, depth: 0 },
    { name: 'Zachter', hue: 0, vividness: 0.8, depth: 0 },
    { name: 'Gedempt', hue: 0, vividness: 0.7, depth: 0 },
    { name: 'Warmer', hue: 10, vividness: 0.78, depth: 0 },
    { name: 'Koeler', hue: -9, vividness: 0.85, depth: 0 },
  ];

  /* ---------- kleurwiskunde ---------- */

  function toRgb(L, C, H) {
    var h = (H * Math.PI) / 180;
    var a = C * Math.cos(h);
    var b = C * Math.sin(h);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }

  function inGamut(rgb) {
    return rgb.every(function (c) {
      return c >= -0.0008 && c <= 1.0008;
    });
  }

  /** OKLCH naar hex, met chroma terugschroeven tot de kleur in sRGB past. */
  function toHex(L, C, H) {
    if (!inGamut(toRgb(L, C, H))) {
      var lo = 0;
      var hi = C;
      for (var i = 0; i < 16; i++) {
        var mid = (lo + hi) / 2;
        if (inGamut(toRgb(L, mid, H))) lo = mid;
        else hi = mid;
      }
      C = lo;
    }
    return (
      '#' +
      toRgb(L, C, H)
        .map(function (c) {
          var g = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
          return Math.round(Math.min(1, Math.max(0, g)) * 255)
            .toString(16)
            .padStart(2, '0');
        })
        .join('')
    );
  }

  /**
   * Bouwt de tien stappen. De diepte-schuif weegt mee via 4·L·(1−L): sterk in
   * het midden van de ramp, bijna nul bij de bleekste tinten en de diepste
   * schaduwen — die moeten bleek en diep blijven.
   */
  function buildRamp(st) {
    var ramp = {};
    TEMPLATE.forEach(function (row) {
      var step = row[0];
      var L = row[1];
      var weight = 4 * L * (1 - L);
      ramp[step] = toHex(
        Math.min(0.995, Math.max(0.02, L + st.depth * weight)),
        row[2] * BASE_CHROMA * st.vividness,
        BASE_HUE + row[3] + st.hue
      );
    });
    return ramp;
  }

  function relativeLuminance(hex) {
    var sum = 0;
    var weights = [0.2126, 0.7152, 0.0722];
    for (var i = 0; i < 3; i++) {
      var c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      sum += weights[i] * (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return sum;
  }

  function contrast(a, b) {
    var x = relativeLuminance(a);
    var y = relativeLuminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /* ---------- toestand ---------- */

  var DEFAULT = { hue: 0, vividness: 1.0, depth: 0 };
  var FEATHER_WHITE = '#faf7f1';
  var INK = '#1b1410';

  function readState() {
    var fromUrl = new URLSearchParams(location.search).get('kleurlab');
    var raw = fromUrl || localStorage.getItem('kleurlab:st') || '';
    var d = raw.split(',').map(Number);
    if (d.length !== 3 || d.some(isNaN)) return Object.assign({}, DEFAULT);
    return {
      hue: Math.max(-25, Math.min(25, d[0])),
      vividness: Math.max(0.4, Math.min(1.1, d[1])),
      depth: Math.max(-0.12, Math.min(0.04, d[2])),
    };
  }

  function asText(st) {
    return st.hue + ',' + st.vividness + ',' + st.depth;
  }

  var state = readState();

  function apply() {
    var ramp = buildRamp(state);
    var css = '';
    Object.keys(ramp).forEach(function (step) {
      document.documentElement.style.setProperty('--color-club-' + step, ramp[step]);
      css += '--color-club-' + step + ':' + ramp[step] + ';';
    });
    try {
      localStorage.setItem('kleurlab:css', css);
      localStorage.setItem('kleurlab:st', asText(state));
    } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.set('kleurlab', asText(state));
    history.replaceState(null, '', url);
    return ramp;
  }

  /* ---------- paneel ---------- */

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#kleurlab{position:fixed;right:1rem;bottom:1rem;z-index:2147483000;width:19.5rem;max-width:calc(100vw - 2rem);',
    'background:#fff;color:#1b1410;border:1px solid #d8d0c4;border-radius:.75rem;box-shadow:0 18px 40px -12px rgba(27,20,16,.45);',
    'font:400 13px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden}',
    '#kleurlab-kop{display:flex;align-items:center;gap:.5rem;padding:.6rem .75rem;background:#1b1410;color:#fff;cursor:pointer;user-select:none}',
    '#kleurlab-kop b{flex:1;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:700}',
    '#kleurlab-kop button{background:none;border:0;color:#fff;font-size:15px;line-height:1;cursor:pointer;padding:.15rem .3rem;opacity:.75}',
    '#kleurlab-kop button:hover{opacity:1}',
    '#kleurlab-body{padding:.75rem;display:grid;gap:.7rem}',
    '#kleurlab.closed #kleurlab-body{display:none}',
    '#kleurlab .presets{display:flex;flex-wrap:wrap;gap:.3rem}',
    '#kleurlab .presets button{border:1px solid #d8d0c4;background:#faf7f1;border-radius:999px;padding:.25rem .55rem;font-size:11.5px;cursor:pointer;color:#493c33}',
    '#kleurlab .presets button:hover{border-color:#6b5c50}',
    '#kleurlab .presets button[aria-pressed="true"]{background:#1b1410;border-color:#1b1410;color:#fff}',
    '#kleurlab label{display:grid;gap:.15rem;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#6b5c50;font-weight:700}',
    '#kleurlab label span{display:flex;justify-content:space-between;align-items:baseline}',
    '#kleurlab label span i{font-style:normal;font-variant-numeric:tabular-nums;color:#1b1410;text-transform:none;letter-spacing:0}',
    '#kleurlab input[type=range]{width:100%;margin:0;accent-color:#493c33}',
    '#kleurlab .strip{display:flex;border-radius:.35rem;overflow:hidden;border:1px solid #d8d0c4}',
    '#kleurlab .strip button{flex:1;height:2.1rem;border:0;padding:0;cursor:copy;font-size:9px;color:#fff;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px}',
    '#kleurlab .strip button:nth-child(-n+4){color:#1b1410}',
    '#kleurlab .metrics{display:grid;gap:.2rem;font-size:11.5px;color:#493c33}',
    '#kleurlab .metrics div{display:flex;justify-content:space-between;gap:.5rem}',
    '#kleurlab .metrics b{font-variant-numeric:tabular-nums}',
    '#kleurlab .metrics .ok{color:#1f7a3d}#kleurlab .metrics .nok{color:#b3261e}',
    '#kleurlab .actions{display:flex;flex-wrap:wrap;gap:.3rem}',
    '#kleurlab .actions button{flex:1;border:1px solid #1b1410;background:#1b1410;color:#fff;border-radius:.35rem;padding:.4rem .5rem;font-size:11.5px;cursor:pointer;white-space:nowrap}',
    '#kleurlab .actions button.soft{background:#fff;color:#1b1410}',
    '#kleurlab .footnote{font-size:10.5px;color:#6b5c50;line-height:1.4}',
    '@media print{#kleurlab{display:none}}',
  ].join('');

  var panel = document.createElement('div');
  panel.id = 'kleurlab';
  panel.innerHTML = [
    '<div id="kleurlab-kop"><b>Kleurlab · clubrood</b><button type="button" data-fold title="Inklappen">–</button><button type="button" data-close title="Kleurlab sluiten">✕</button></div>',
    '<div id="kleurlab-body">',
    '<div class="presets"></div>',
    '<label><span>Felheid<i data-out="vividness"></i></span><input type="range" data-slider="vividness" min="0.4" max="1.1" step="0.01"></label>',
    '<label><span>Diepte<i data-out="depth"></i></span><input type="range" data-slider="depth" min="-0.12" max="0.04" step="0.005"></label>',
    '<label><span>Tint<i data-out="hue"></i></span><input type="range" data-slider="hue" min="-25" max="25" step="1"></label>',
    '<div class="strip"></div>',
    '<div class="metrics"></div>',
    '<div class="actions"><button type="button" data-link>Kopieer link</button><button type="button" class="soft" data-css>Kopieer CSS</button></div>',
    '<p class="footnote"></p>',
    '</div>',
  ].join('');

  var presetBar = panel.querySelector('.presets');
  PRESETS.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.name;
    b.dataset.preset = String(i);
    presetBar.appendChild(b);
  });

  var sliders = {};
  panel.querySelectorAll('[data-slider]').forEach(function (el) {
    sliders[el.dataset.slider] = el;
    el.addEventListener('input', function () {
      state[el.dataset.slider] = Number(el.value);
      refresh();
    });
  });

  var strip = panel.querySelector('.strip');
  var metrics = panel.querySelector('.metrics');

  var FOOTNOTE =
    'Klik een staal om de hexcode te kopiëren. Felheid mag vrij — alle metingen blijven groen. ' +
    'Diepte laat de inkt-tekst op het rode veerpaneel zakken: houd ze op 0 tenzij je dat paneel meeneemt. ' +
    'Alles zit enkel in jouw browser; de site zelf verandert niet.';
  panel.querySelector('.footnote').textContent = FOOTNOTE;

  function notice(text) {
    var el = panel.querySelector('.footnote');
    el.textContent = text;
    clearTimeout(notice.t);
    notice.t = setTimeout(function () {
      el.textContent = FOOTNOTE;
    }, 2600);
  }

  function copy(text, message) {
    (navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : Promise.reject()
    ).then(
      function () {
        notice(message);
      },
      function () {
        notice('Kopiëren lukte niet — hier is het: ' + text);
      }
    );
  }

  function row(label, value, threshold) {
    return (
      '<div><span>' +
      label +
      '</span><b class="' +
      (value >= threshold ? 'ok' : 'nok') +
      '">' +
      value.toFixed(2) +
      ':1' +
      (value >= threshold ? ' ✓' : ' ✕') +
      '</b></div>'
    );
  }

  function refresh() {
    var ramp = apply();

    Object.keys(sliders).forEach(function (k) {
      sliders[k].value = String(state[k]);
    });
    panel.querySelector('[data-out="vividness"]').textContent = Math.round(state.vividness * 100) + '%';
    panel.querySelector('[data-out="depth"]').textContent =
      (state.depth > 0 ? '+' : '') + Math.round(state.depth * 1000) / 10;
    panel.querySelector('[data-out="hue"]').textContent =
      (state.hue > 0 ? '+' : '') + state.hue + '°';

    presetBar.querySelectorAll('button').forEach(function (b) {
      var p = PRESETS[Number(b.dataset.preset)];
      b.setAttribute(
        'aria-pressed',
        String(
          Math.abs(p.vividness - state.vividness) < 0.005 &&
            Math.abs(p.depth - state.depth) < 0.0025 &&
            p.hue === state.hue
        )
      );
    });

    strip.innerHTML = '';
    Object.keys(ramp).forEach(function (step) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.background = ramp[step];
      b.textContent = step;
      b.title = 'club-' + step + ' · ' + ramp[step];
      b.addEventListener('click', function () {
        copy(ramp[step], 'club-' + step + ' (' + ramp[step] + ') gekopieerd.');
      });
      strip.appendChild(b);
    });

    // De combinaties die de site echt draagt (zie de twee-roden-regel in
    // DESIGN.md): witte tekst staat op club-600, donkere tekst op club-500,
    // kleine rode tekst op veerwit is club-700. AA vraagt 4,5:1 voor gewone
    // tekst, 3:1 voor grote tekst en voor lijnen zoals de vluchtdraad.
    metrics.innerHTML =
      row('wit op club-600', contrast('#ffffff', ramp[600]), 4.5) +
      row('inkt op club-500', contrast(INK, ramp[500]), 4.5) +
      row('club-700 op veerwit', contrast(ramp[700], FEATHER_WHITE), 4.5) +
      row('draad club-500 (3:1)', contrast(ramp[500], FEATHER_WHITE), 3);
  }

  presetBar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]');
    if (!b) return;
    state = Object.assign({}, PRESETS[Number(b.dataset.preset)]);
    delete state.name;
    refresh();
  });

  panel.querySelector('[data-link]').addEventListener('click', function () {
    var url = new URL(location.href);
    url.searchParams.set('kleurlab', asText(state));
    copy(url.href, 'Link gekopieerd — deel hem in de groep.');
  });

  panel.querySelector('[data-css]').addEventListener('click', function () {
    var ramp = buildRamp(state);
    var css = Object.keys(ramp)
      .map(function (step) {
        return '  --color-club-' + step + ': ' + ramp[step] + ';';
      })
      .join('\n');
    copy(css, 'CSS gekopieerd — dit blok vervangt de rode tokens.');
  });

  panel.querySelector('#kleurlab-kop').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) {
      try {
        localStorage.removeItem('kleurlab:aan');
        localStorage.removeItem('kleurlab:css');
        localStorage.removeItem('kleurlab:st');
      } catch (err) {}
      var url = new URL(location.href);
      url.searchParams.delete('kleurlab');
      location.replace(url.href);
      return;
    }
    panel.classList.toggle('closed');
    panel.querySelector('[data-fold]').textContent = panel.classList.contains('closed')
      ? '+'
      : '–';
  });

  function start() {
    document.head.appendChild(styleEl);
    document.body.appendChild(panel);
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
