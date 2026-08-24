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
  band: 'rode-band',
  slotKnoppen: 'slot-knoppen',
  kop: 'hero-kop',
  heroSlot: 'volgend-moment',
} as const;

// Onder md staat alle tekst in één volle kolom (px-4): de diagonaal van kurk
// naar shuttle en die van de rail naar het slot zouden dwars door koppen en
// lopende tekst snijden. De baan blijft daar dezelfde vlucht — lancering,
// hangmoment bij de shuttle, val — maar loopt door de vrije stroken: omhoog
// langs de linkermarge, over de kop heen, langs de rechtermarge naar beneden
// en dan schuin door de lege band onder de tekst de rode band in, waar rood op
// rood de oversteek naar de rail verbergt.
const SMAL_TOT = 768;
// Baan in de buitenmarge: de tekstkolom begint op px-4 (16px), de draad (4px)
// blijft er met zijn hele dikte links van.
const MARGE = 7;

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
    const smal = wrect.width < SMAL_TOT;
    const rechterMarge = wrect.width - MARGE;
    const eindX = smal ? MARGE : wrect.width * 0.52;
    const dx = G.x - K.x;
    const dy = K.y - G.y;

    // De rode band vangt de oversteek van rechter- naar linkermarge; zonder
    // band (of zonder id) valt de draad terug op de ruimte boven de rail.
    const bandEl = document.getElementById(IDS.band);
    const brect = bandEl?.getBoundingClientRect();
    const bandTop = brect ? brect.top - wrect.top : railStart - 360;
    const bandOnder = brect ? brect.bottom - wrect.top : railStart - 120;

    // Hoogte van de boog over de hero-kop heen: boven de regelbox van de kop,
    // nooit hoger dan nodig en nooit tot tegen de paginarand. Vanaf sm groeit
    // de kop tot boven de shuttle, dus G.y alleen volstaat niet.
    const kopEl = document.getElementById(IDS.kop);
    const kopTop = kopEl ? kopEl.getBoundingClientRect().top - wrect.top : G.y;
    const boogY = Math.max(24, Math.min(G.y, kopTop - 16));
    // Onderkant van de herokolom: daaronder ligt de vrije band met de
    // verenkrans, waar de val schuin doorheen mag duiken.
    const heroSlotEl = document.getElementById(IDS.heroSlot);
    const valY = heroSlotEl
      ? heroSlotEl.getBoundingClientRect().bottom - wrect.top + 24
      : K.y - 80;

    kern.setAttribute(
      'd',
      smal
        ? [
            `M ${K.x} ${K.y}`,
            // lancering: uit de kurk naar links en in één boog omhoog
            `C ${K.x - 60} ${K.y + 6}, ${MARGE} ${K.y - dy * 0.32}, ${MARGE} ${boogY + 30}`,
            // over de kop heen naar het hangmoment bij de shuttle
            `C ${MARGE} ${boogY + 8}, ${G.x - 240} ${boogY}, ${G.x} ${G.y}`,
            // de val: langs de rechtermarge naar beneden
            `C ${G.x + 46} ${G.y + 50}, ${rechterMarge} ${G.y + 40}, ${rechterMarge} ${valY}`,
            // schuin door de vrije band onder de tekst, langs de kurk, de rode
            // band in — daar (rood op rood) steekt hij onzichtbaar over
            `C ${rechterMarge} ${valY + 80}, ${wrect.width * 0.6} ${bandTop - 24}, ${railX} ${bandOnder + 24}`,
            `L ${railX} ${J.y}`,
            // de rail verlaten richting slot: op mobiel blijft hij in de marge
            `C ${railX} ${J.y + 200}, ${eindX} ${slotTop - 200}, ${eindX} ${slotTop}`,
          ].join(' ')
        : [
            `M ${K.x} ${K.y}`,
            `C ${K.x + dx * 0.185} ${K.y - dy * 0.466}, ${K.x + dx * 0.43} ${K.y - dy * 0.862}, ${G.x} ${G.y}`,
            `C ${G.x + 90} ${G.y + 150}, ${railX} ${railStart - 320}, ${railX} ${railStart}`,
            `L ${railX} ${J.y}`,
            `C ${railX} ${J.y + 260}, ${eindX} ${slotTop - 220}, ${eindX} ${slotTop}`,
          ].join(' '),
    );

    // Staart in slot-lokale coördinaten: verticaal binnenkomen, landen op de foto
    const frect = foto.getBoundingClientRect();
    // Op mobiel is de foto breed en laag: dan wat dieper landen, anders komt de
    // staart op de schuine snede van de clip-path uit i.p.v. óp de foto.
    const landX = frect.left - srect.left + (smal ? 64 : 48);
    const landY = frect.top - srect.top + (smal ? Math.min(96, frect.height * 0.38) : 40);
    const staartX = eindX + wrect.left - srect.left;
    if (smal) {
      // Op mobiel staat de foto ónder de tekst: eerst rechtlijnig door de marge
      // langs kop, tekst en knoppen, en pas daaronder inbuigen naar de foto.
      const knoppen = document.getElementById(IDS.slotKnoppen);
      const vrij = knoppen ? knoppen.getBoundingClientRect().bottom - srect.top + 16 : landY - 120;
      const bocht = Math.min(Math.max(vrij, landY * 0.5), landY - 40);
      staart.setAttribute('d', `M ${staartX} 0 L ${staartX} ${bocht} C ${staartX} ${bocht + (landY - bocht) * 0.6}, ${landX - 60} ${landY}, ${landX} ${landY}`);
    } else {
      staart.setAttribute('d', `M ${staartX} 0 C ${staartX} ${landY * 0.7}, ${landX - 120} ${landY - 40}, ${landX} ${landY}`);
    }

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
