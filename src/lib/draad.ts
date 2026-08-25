// De vluchtdraad op de homepage: één doorlopende rode lijn van kurk tot slot,
// altijd volledig zichtbaar. De pluim staat statisch in de hero (puur CSS).

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
  heroSlot: 'volgend-moment',
} as const;

// Onder md staat alle tekst in één volle kolom (px-4): de diagonaal van kurk
// naar de shuttle zou dwars door koppen en lopende tekst snijden. In plaats van
// eromheen te sluipen langs de schermranden — dat leest als een kader, niet als
// een vlucht — vliegt de baan daar dezelfde parabool in miniatuur: uit de kurk
// omhoog, een hangmoment in de vrije band onder de tekst, en rechts weer neer
// de rode band in, waar rood op rood de oversteek naar de rail verbergt.
const SMAL_TOT = 768;
// Baan in de buitenmarge: de tekstkolom begint op px-4 (16px), de draad (4px)
// blijft er met zijn hele dikte links van.
const MARGE = 7;

function middenVan(el: Element, wrect: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left - wrect.left + r.width / 2, y: r.top - wrect.top + r.height / 2 };
}

/**
 * Start de landing-animatie (.vlucht → .geland) en bouwt de vluchtdraad.
 * Geeft `herbouw` terug zodat dataloaders de draad kunnen herberekenen wanneer
 * secties van hoogte veranderen of dichtklappen.
 */
export function initDraad(): { herbouw: () => void } {
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
    const eindX = smal ? MARGE : wrect.width * 0.52;
    const dx = G.x - K.x;
    const dy = K.y - G.y;

    // De rode band vangt de oversteek van rechter- naar linkermarge; zonder
    // band (of zonder id) valt de draad terug op de ruimte boven de rail.
    const bandEl = document.getElementById(IDS.band);
    const brect = bandEl?.getBoundingClientRect();
    const bandTop = brect ? brect.top - wrect.top : railStart - 360;
    const bandOnder = brect ? brect.bottom - wrect.top : railStart - 120;
    // De val na het hangmoment: x blijft bij de pluim, y duikt de rode band in.
    const invalX = Math.min(wrect.width - 34, Math.max(wrect.width * 0.72, G.x));

    kern.setAttribute(
      'd',
      smal
        ? [
            `M ${K.x} ${K.y}`,
            // Mini-parabool in de buitenmarge; eindpunt is het midden van de pluim (G).
            `C ${K.x + 24} ${K.y - (K.y - G.y) * 0.66}, ${G.x - 74} ${G.y}, ${G.x} ${G.y}`,
            // de val: kort over de top, dan bijna verticaal de rode band in
            `C ${G.x + 52} ${G.y}, ${invalX} ${Math.min(G.y + 44, bandTop)}, ${invalX} ${bandTop + 18}`,
            // binnen de band (rood op rood) steekt hij onzichtbaar over naar de rail
            `C ${invalX} ${bandOnder - 20}, ${railX} ${bandTop + 20}, ${railX} ${bandOnder + 24}`,
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

    kern.style.strokeDasharray = staart.style.strokeDasharray = 'none';
    kern.style.strokeDashoffset = staart.style.strokeDashoffset = '0';
  }

  let herbouwTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(herbouwTimer);
    herbouwTimer = setTimeout(bouwDraad, 200);
  });
  if (document.readyState === 'complete') bouwDraad();
  else window.addEventListener('load', bouwDraad);

  return { herbouw: bouwDraad };
}
