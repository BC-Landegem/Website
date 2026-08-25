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
  var SJABLOON = [
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
  var BASIS_CHROMA = 0.2116;
  var BASIS_TINT = 31.96;

  /**
   * Alle presets houden diepte op 0. Sinds witte tekst op club-600 staat en
   * donkere tekst op club-500 (de twee-roden-regel in DESIGN.md) is diepte niet
   * meer nodig om contrast te halen — en breekt ze juist iets: een donkerder
   * club-500 zakt onder 4,5:1 voor de inkt-tekst op het rode veerpaneel.
   * Felheid mag daarentegen de hele weg naar 62% zonder één meting te breken.
   */
  var PRESETS = [
    { naam: 'Huidig', tint: 0, fel: 1.0, diepte: 0 },
    { naam: 'Iets zachter', tint: 0, fel: 0.9, diepte: 0 },
    { naam: 'Zachter', tint: 0, fel: 0.8, diepte: 0 },
    { naam: 'Gedempt', tint: 0, fel: 0.7, diepte: 0 },
    { naam: 'Warmer', tint: 10, fel: 0.78, diepte: 0 },
    { naam: 'Koeler', tint: -9, fel: 0.85, diepte: 0 },
  ];

  /* ---------- kleurwiskunde ---------- */

  function naarRgb(L, C, H) {
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

  function binnenGamut(rgb) {
    return rgb.every(function (c) {
      return c >= -0.0008 && c <= 1.0008;
    });
  }

  /** OKLCH naar hex, met chroma terugschroeven tot de kleur in sRGB past. */
  function naarHex(L, C, H) {
    if (!binnenGamut(naarRgb(L, C, H))) {
      var lo = 0;
      var hi = C;
      for (var i = 0; i < 16; i++) {
        var mid = (lo + hi) / 2;
        if (binnenGamut(naarRgb(L, mid, H))) lo = mid;
        else hi = mid;
      }
      C = lo;
    }
    return (
      '#' +
      naarRgb(L, C, H)
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
  function bouwRamp(st) {
    var ramp = {};
    SJABLOON.forEach(function (rij) {
      var stap = rij[0];
      var L = rij[1];
      var weging = 4 * L * (1 - L);
      ramp[stap] = naarHex(
        Math.min(0.995, Math.max(0.02, L + st.diepte * weging)),
        rij[2] * BASIS_CHROMA * st.fel,
        BASIS_TINT + rij[3] + st.tint
      );
    });
    return ramp;
  }

  function relatieveLuminantie(hex) {
    var som = 0;
    var wegingen = [0.2126, 0.7152, 0.0722];
    for (var i = 0; i < 3; i++) {
      var c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      som += wegingen[i] * (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return som;
  }

  function contrast(a, b) {
    var x = relatieveLuminantie(a);
    var y = relatieveLuminantie(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /* ---------- toestand ---------- */

  var HUIDIG = { tint: 0, fel: 1.0, diepte: 0 };
  var VEERWIT = '#faf7f1';
  var INKT = '#1b1410';

  function leesToestand() {
    var uitUrl = new URLSearchParams(location.search).get('kleurlab');
    var ruw = uitUrl || localStorage.getItem('kleurlab:st') || '';
    var d = ruw.split(',').map(Number);
    if (d.length !== 3 || d.some(isNaN)) return Object.assign({}, HUIDIG);
    return {
      tint: Math.max(-25, Math.min(25, d[0])),
      fel: Math.max(0.4, Math.min(1.1, d[1])),
      diepte: Math.max(-0.12, Math.min(0.04, d[2])),
    };
  }

  function alsTekst(st) {
    return st.tint + ',' + st.fel + ',' + st.diepte;
  }

  var toestand = leesToestand();

  function pasToe() {
    var ramp = bouwRamp(toestand);
    var css = '';
    Object.keys(ramp).forEach(function (stap) {
      document.documentElement.style.setProperty('--color-club-' + stap, ramp[stap]);
      css += '--color-club-' + stap + ':' + ramp[stap] + ';';
    });
    try {
      localStorage.setItem('kleurlab:css', css);
      localStorage.setItem('kleurlab:st', alsTekst(toestand));
    } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.set('kleurlab', alsTekst(toestand));
    history.replaceState(null, '', url);
    return ramp;
  }

  /* ---------- paneel ---------- */

  var stijl = document.createElement('style');
  stijl.textContent = [
    '#kleurlab{position:fixed;right:1rem;bottom:1rem;z-index:2147483000;width:19.5rem;max-width:calc(100vw - 2rem);',
    'background:#fff;color:#1b1410;border:1px solid #d8d0c4;border-radius:.75rem;box-shadow:0 18px 40px -12px rgba(27,20,16,.45);',
    'font:400 13px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden}',
    '#kleurlab-kop{display:flex;align-items:center;gap:.5rem;padding:.6rem .75rem;background:#1b1410;color:#fff;cursor:pointer;user-select:none}',
    '#kleurlab-kop b{flex:1;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:700}',
    '#kleurlab-kop button{background:none;border:0;color:#fff;font-size:15px;line-height:1;cursor:pointer;padding:.15rem .3rem;opacity:.75}',
    '#kleurlab-kop button:hover{opacity:1}',
    '#kleurlab-body{padding:.75rem;display:grid;gap:.7rem}',
    '#kleurlab.dicht #kleurlab-body{display:none}',
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
    '#kleurlab .meting{display:grid;gap:.2rem;font-size:11.5px;color:#493c33}',
    '#kleurlab .meting div{display:flex;justify-content:space-between;gap:.5rem}',
    '#kleurlab .meting b{font-variant-numeric:tabular-nums}',
    '#kleurlab .meting .ok{color:#1f7a3d}#kleurlab .meting .nok{color:#b3261e}',
    '#kleurlab .acties{display:flex;flex-wrap:wrap;gap:.3rem}',
    '#kleurlab .acties button{flex:1;border:1px solid #1b1410;background:#1b1410;color:#fff;border-radius:.35rem;padding:.4rem .5rem;font-size:11.5px;cursor:pointer;white-space:nowrap}',
    '#kleurlab .acties button.zacht{background:#fff;color:#1b1410}',
    '#kleurlab .voet{font-size:10.5px;color:#6b5c50;line-height:1.4}',
    '@media print{#kleurlab{display:none}}',
  ].join('');

  var paneel = document.createElement('div');
  paneel.id = 'kleurlab';
  paneel.innerHTML = [
    '<div id="kleurlab-kop"><b>Kleurlab · clubrood</b><button type="button" data-plooi title="Inklappen">–</button><button type="button" data-sluit title="Kleurlab sluiten">✕</button></div>',
    '<div id="kleurlab-body">',
    '<div class="presets"></div>',
    '<label><span>Felheid<i data-uit="fel"></i></span><input type="range" data-schuif="fel" min="0.4" max="1.1" step="0.01"></label>',
    '<label><span>Diepte<i data-uit="diepte"></i></span><input type="range" data-schuif="diepte" min="-0.12" max="0.04" step="0.005"></label>',
    '<label><span>Tint<i data-uit="tint"></i></span><input type="range" data-schuif="tint" min="-25" max="25" step="1"></label>',
    '<div class="strip"></div>',
    '<div class="meting"></div>',
    '<div class="acties"><button type="button" data-link>Kopieer link</button><button type="button" class="zacht" data-css>Kopieer CSS</button></div>',
    '<p class="voet"></p>',
    '</div>',
  ].join('');

  var presetBalk = paneel.querySelector('.presets');
  PRESETS.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.naam;
    b.dataset.preset = String(i);
    presetBalk.appendChild(b);
  });

  var schuiven = {};
  paneel.querySelectorAll('[data-schuif]').forEach(function (el) {
    schuiven[el.dataset.schuif] = el;
    el.addEventListener('input', function () {
      toestand[el.dataset.schuif] = Number(el.value);
      verver();
    });
  });

  var strip = paneel.querySelector('.strip');
  var meting = paneel.querySelector('.meting');

  var VOET =
    'Klik een staal om de hexcode te kopiëren. Felheid mag vrij — alle metingen blijven groen. ' +
    'Diepte laat de inkt-tekst op het rode veerpaneel zakken: houd ze op 0 tenzij je dat paneel meeneemt. ' +
    'Alles zit enkel in jouw browser; de site zelf verandert niet.';
  paneel.querySelector('.voet').textContent = VOET;

  function melding(tekst) {
    var el = paneel.querySelector('.voet');
    el.textContent = tekst;
    clearTimeout(melding.t);
    melding.t = setTimeout(function () {
      el.textContent = VOET;
    }, 2600);
  }

  function kopieer(tekst, bericht) {
    (navigator.clipboard
      ? navigator.clipboard.writeText(tekst)
      : Promise.reject()
    ).then(
      function () {
        melding(bericht);
      },
      function () {
        melding('Kopiëren lukte niet — hier is het: ' + tekst);
      }
    );
  }

  function regel(label, waarde, drempel) {
    return (
      '<div><span>' +
      label +
      '</span><b class="' +
      (waarde >= drempel ? 'ok' : 'nok') +
      '">' +
      waarde.toFixed(2) +
      ':1' +
      (waarde >= drempel ? ' ✓' : ' ✕') +
      '</b></div>'
    );
  }

  function verver() {
    var ramp = pasToe();

    Object.keys(schuiven).forEach(function (k) {
      schuiven[k].value = String(toestand[k]);
    });
    paneel.querySelector('[data-uit="fel"]').textContent = Math.round(toestand.fel * 100) + '%';
    paneel.querySelector('[data-uit="diepte"]').textContent =
      (toestand.diepte > 0 ? '+' : '') + Math.round(toestand.diepte * 1000) / 10;
    paneel.querySelector('[data-uit="tint"]').textContent =
      (toestand.tint > 0 ? '+' : '') + toestand.tint + '°';

    presetBalk.querySelectorAll('button').forEach(function (b) {
      var p = PRESETS[Number(b.dataset.preset)];
      b.setAttribute(
        'aria-pressed',
        String(
          Math.abs(p.fel - toestand.fel) < 0.005 &&
            Math.abs(p.diepte - toestand.diepte) < 0.0025 &&
            p.tint === toestand.tint
        )
      );
    });

    strip.innerHTML = '';
    Object.keys(ramp).forEach(function (stap) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.background = ramp[stap];
      b.textContent = stap;
      b.title = 'club-' + stap + ' · ' + ramp[stap];
      b.addEventListener('click', function () {
        kopieer(ramp[stap], 'club-' + stap + ' (' + ramp[stap] + ') gekopieerd.');
      });
      strip.appendChild(b);
    });

    // De combinaties die de site echt draagt (zie de twee-roden-regel in
    // DESIGN.md): witte tekst staat op club-600, donkere tekst op club-500,
    // kleine rode tekst op veerwit is club-700. AA vraagt 4,5:1 voor gewone
    // tekst, 3:1 voor grote tekst en voor lijnen zoals de vluchtdraad.
    meting.innerHTML =
      regel('wit op club-600', contrast('#ffffff', ramp[600]), 4.5) +
      regel('inkt op club-500', contrast(INKT, ramp[500]), 4.5) +
      regel('club-700 op veerwit', contrast(ramp[700], VEERWIT), 4.5) +
      regel('draad club-500 (3:1)', contrast(ramp[500], VEERWIT), 3);
  }

  presetBalk.addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]');
    if (!b) return;
    toestand = Object.assign({}, PRESETS[Number(b.dataset.preset)]);
    delete toestand.naam;
    verver();
  });

  paneel.querySelector('[data-link]').addEventListener('click', function () {
    var url = new URL(location.href);
    url.searchParams.set('kleurlab', alsTekst(toestand));
    kopieer(url.href, 'Link gekopieerd — deel hem in de groep.');
  });

  paneel.querySelector('[data-css]').addEventListener('click', function () {
    var ramp = bouwRamp(toestand);
    var css = Object.keys(ramp)
      .map(function (stap) {
        return '  --color-club-' + stap + ': ' + ramp[stap] + ';';
      })
      .join('\n');
    kopieer(css, 'CSS gekopieerd — dit blok vervangt de rode tokens.');
  });

  paneel.querySelector('#kleurlab-kop').addEventListener('click', function (e) {
    if (e.target.closest('[data-sluit]')) {
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
    paneel.classList.toggle('dicht');
    paneel.querySelector('[data-plooi]').textContent = paneel.classList.contains('dicht')
      ? '+'
      : '–';
  });

  function start() {
    document.head.appendChild(stijl);
    document.body.appendChild(paneel);
    verver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
