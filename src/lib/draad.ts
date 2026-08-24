// De vluchtdraad op de homepage: één doorlopende rode lijn van kurk tot slot,
// getekend naarmate de bezoeker scrolt. Plus de landing-animatie (.vlucht →
// .geland) via een IntersectionObserver. Zonder JS is er geen draad, maar alle
// inhoud blijft gewoon zichtbaar.

// Alle DOM-ankers van de draad op één plek: hernoem je een id in index.astro,
// dan is dit de inventaris die mee moet.
const IDS = {
  wrapper: 'pagina',
  kern: 'draad-kern',
  staart: 'draad-staart',
  kurk: 'kurk-cta',
  glyph: 'shuttle-glyph',
  uren: 'speeluren-lijst',
  jaar: 'punt-1987',
  slot: 'slot-sectie',
  foto: 'slot-foto',
  intraSectie: 'intra-sectie',
  intraPunt: 'punt-intra',
} as const;

function middenVan(el: Element, wrect: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left - wrect.left + r.width / 2, y: r.top - wrect.top + r.height / 2 };
}

/**
 * Start de landing-animatie en de vluchtdraad. Geeft `herbouw` terug zodat
 * dataloaders de draad kunnen herberekenen wanneer secties van hoogte
 * veranderen of dichtklappen.
 */
export function initDraad(): { herbouw: () => void } {
  // — Elementen laten neerdalen zodra ze in beeld komen —
  const kijker = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('geland');
          kijker.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 },
  );
  document.querySelectorAll('.vlucht').forEach((el) => kijker.observe(el));

  const wrapper = document.getElementById(IDS.wrapper);
  const kern = document.getElementById(IDS.kern) as SVGPathElement | null;
  const staart = document.getElementById(IDS.staart) as SVGPathElement | null;
  const rustig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let monsters: { y: number; len: number }[] = [];
  let kernLengte = 0;
  let staartLengte = 0;

  function bouwDraad() {
    const kurk = document.getElementById(IDS.kurk);
    const glyph = document.getElementById(IDS.glyph);
    const uren = document.getElementById(IDS.uren);
    const jaar = document.getElementById(IDS.jaar);
    const slot = document.getElementById(IDS.slot);
    const foto = document.getElementById(IDS.foto);
    if (!wrapper || !kern || !staart || !kurk || !glyph || !uren || !jaar || !slot || !foto) return;

    const wrect = wrapper.getBoundingClientRect();
    const K = middenVan(kurk, wrect);
    const G = middenVan(glyph, wrect);
    const urect = uren.getBoundingClientRect();
    const railX = urect.left - wrect.left + 6;
    const urenTop = urect.top - wrect.top + 8;
    // Als de intra top-10 zichtbaar is, landt de draad daar eerst op de rail
    const intraSectie = document.getElementById(IDS.intraSectie);
    const intraPunt = document.getElementById(IDS.intraPunt);
    const railStart =
      intraSectie && intraPunt && !intraSectie.classList.contains('hidden')
        ? middenVan(intraPunt, wrect).y
        : urenTop;
    const J = middenVan(jaar, wrect);
    const srect = slot.getBoundingClientRect();
    const slotTop = srect.top - wrect.top;
    const eindX = wrect.width * 0.52;
    const dx = G.x - K.x;
    const dy = K.y - G.y;

    kern.setAttribute(
      'd',
      [
        `M ${K.x} ${K.y}`,
        `C ${K.x + dx * 0.185} ${K.y - dy * 0.466}, ${K.x + dx * 0.43} ${K.y - dy * 0.862}, ${G.x} ${G.y}`,
        `C ${G.x + 90} ${G.y + 150}, ${railX} ${railStart - 320}, ${railX} ${railStart}`,
        `L ${railX} ${J.y}`,
        `C ${railX} ${J.y + 260}, ${eindX} ${slotTop - 220}, ${eindX} ${slotTop}`,
      ].join(' '),
    );

    // Staart in slot-lokale coördinaten: verticaal binnenkomen, landen op de foto
    const frect = foto.getBoundingClientRect();
    const landX = frect.left - srect.left + 48;
    const landY = frect.top - srect.top + 40;
    const staartX = eindX + wrect.left - srect.left;
    staart.setAttribute('d', `M ${staartX} 0 C ${staartX} ${landY * 0.7}, ${landX - 120} ${landY - 40}, ${landX} ${landY}`);

    kernLengte = kern.getTotalLength();
    staartLengte = staart.getTotalLength();
    monsters = [];
    for (let i = 0; i <= 240; i++) {
      const len = (kernLengte * i) / 240;
      monsters.push({ y: kern.getPointAtLength(len).y, len });
    }
    for (let i = 0; i <= 40; i++) {
      const len = (staartLengte * i) / 40;
      monsters.push({ y: slotTop + staart.getPointAtLength(len).y, len: kernLengte + len });
    }
    if (rustig) {
      kern.style.strokeDasharray = staart.style.strokeDasharray = 'none';
      kern.style.strokeDashoffset = staart.style.strokeDashoffset = '0';
    } else {
      kern.style.strokeDasharray = String(kernLengte + 2);
      staart.style.strokeDasharray = String(staartLengte + 2);
      tekenDraad();
    }
  }

  function tekenDraad() {
    if (!wrapper || !kern || !staart || !monsters.length) return;
    const zichtbaarTot = -wrapper.getBoundingClientRect().top + window.innerHeight * 0.85;
    let len = 0;
    for (const m of monsters) {
      if (m.y > zichtbaarTot) break;
      len = m.len;
    }
    kern.style.strokeDashoffset = String(Math.max(0, kernLengte - len));
    staart.style.strokeDashoffset = String(Math.max(0, staartLengte - Math.max(0, len - kernLengte)));
  }

  let scrollTik = false;
  window.addEventListener(
    'scroll',
    () => {
      if (rustig || scrollTik) return;
      scrollTik = true;
      requestAnimationFrame(() => {
        tekenDraad();
        scrollTik = false;
      });
    },
    { passive: true },
  );
  let herbouwTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(herbouwTimer);
    herbouwTimer = setTimeout(bouwDraad, 200);
  });
  if (document.readyState === 'complete') bouwDraad();
  else window.addEventListener('load', bouwDraad);

  return { herbouw: bouwDraad };
}
