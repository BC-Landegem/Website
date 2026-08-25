// De vluchtdraad op de homepage: één doorlopende rode lijn van kurk tot slot,
// getekend naarmate de bezoeker scrolt. Plus de landing-animatie (.vlucht →
// .geland) via een IntersectionObserver. Zonder JS is er geen draad, maar alle
// inhoud blijft gewoon zichtbaar.

// Alle DOM-ankers van de draad op één plek: hernoem je een id in index.astro,
// dan is dit de inventaris die mee moet.
const IDS = {
  wrapper: 'pagina',
  core: 'draad-kern',
  tail: 'draad-staart',
  cork: 'kurk-cta',
  glyph: 'shuttle-glyph',
  hours: 'speeluren-lijst',
  year: 'punt-1987',
  ending: 'slot-sectie',
  photo: 'slot-foto',
  intraSection: 'intra-sectie',
  intraPoint: 'punt-intra',
  ribbon: 'rode-band',
  endingButtons: 'slot-knoppen',
  heroNextMoment: 'volgend-moment',
} as const;

// Onder md staat alle tekst in één volle kolom (px-4): de diagonaal van kurk
// naar shuttle zou dwars door koppen en lopende tekst snijden. In plaats van
// eromheen te sluipen langs de schermranden — dat leest als een kader, niet als
// een vlucht — vliegt de baan daar dezelfde parabool in miniatuur: uit de kurk
// omhoog, een hangmoment in de vrije band onder de tekst, en rechts weer neer
// de rode band in, waar rood op rood de oversteek naar de rail verbergt. De
// shuttle-glyph hangt op mobiel los in de lucht, vóór de draad uit.
const NARROW_UP_TO = 768;
// Baan in de buitenmarge: de tekstkolom begint op px-4 (16px), de draad (4px)
// blijft er met zijn hele dikte links van.
const MARGIN = 7;

function centerOf(el: Element, wrect: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left - wrect.left + r.width / 2, y: r.top - wrect.top + r.height / 2 };
}

/**
 * Start de landing-animatie en de vluchtdraad. Geeft `herbouw` terug zodat
 * dataloaders de draad kunnen herberekenen wanneer secties van hoogte
 * veranderen of dichtklappen.
 */
export function initThread(): { rebuild: () => void } {
  // — Elementen laten neerdalen zodra ze in beeld komen —
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('geland');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 },
  );
  document.querySelectorAll('.vlucht').forEach((el) => observer.observe(el));

  const wrapper = document.getElementById(IDS.wrapper);
  const core = document.getElementById(IDS.core) as SVGPathElement | null;
  const tail = document.getElementById(IDS.tail) as SVGPathElement | null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let samples: { y: number; len: number }[] = [];
  let coreLength = 0;
  let tailLength = 0;

  function buildThread() {
    const cork = document.getElementById(IDS.cork);
    const glyph = document.getElementById(IDS.glyph);
    const hours = document.getElementById(IDS.hours);
    const year = document.getElementById(IDS.year);
    const ending = document.getElementById(IDS.ending);
    const photo = document.getElementById(IDS.photo);
    if (!wrapper || !core || !tail || !cork || !glyph || !hours || !year || !ending || !photo) return;

    const wrect = wrapper.getBoundingClientRect();
    const K = centerOf(cork, wrect);
    const corkRadius = cork.getBoundingClientRect().width / 2;
    const G = centerOf(glyph, wrect);
    const urect = hours.getBoundingClientRect();
    const railX = urect.left - wrect.left + 6;
    const hoursTop = urect.top - wrect.top + 8;
    // Als de intra top-10 zichtbaar is, landt de draad daar eerst op de rail
    const intraSection = document.getElementById(IDS.intraSection);
    const intraPoint = document.getElementById(IDS.intraPoint);
    const railStart =
      intraSection && intraPoint && !intraSection.classList.contains('hidden')
        ? centerOf(intraPoint, wrect).y
        : hoursTop;
    const J = centerOf(year, wrect);
    const srect = ending.getBoundingClientRect();
    const endingTop = srect.top - wrect.top;
    const narrow = wrect.width < NARROW_UP_TO;
    const endX = narrow ? MARGIN : wrect.width * 0.52;
    const dx = G.x - K.x;
    const dy = K.y - G.y;

    // De rode band vangt de oversteek van rechter- naar linkermarge; zonder
    // band (of zonder id) valt de draad terug op de ruimte boven de rail.
    const ribbonEl = document.getElementById(IDS.ribbon);
    const brect = ribbonEl?.getBoundingClientRect();
    const ribbonTop = brect ? brect.top - wrect.top : railStart - 360;
    const ribbonBottom = brect ? brect.bottom - wrect.top : railStart - 120;

    // Onderkant van de herokolom: daaronder ligt de vrije band met de
    // verenkrans, waar de miniatuurparabool zijn hele vlucht in kwijt kan.
    const heroNextMomentEl = document.getElementById(IDS.heroNextMoment);
    const dropY = heroNextMomentEl
      ? heroNextMomentEl.getBoundingClientRect().bottom - wrect.top + 24
      : K.y - 80;
    // Het hangmoment: zo hoog als de vrije band toelaat (nooit ín de tekst) en
    // altijd ruim boven de kurk, anders is het geen boog meer maar een deuk.
    const hangY = Math.min(Math.max(dropY, K.y - 190), K.y - corkRadius - 30);
    // De val komt precies onder de shuttle-glyph neer: die hangt op mobiel los
    // in de lucht, en deze uitlijning maakt hem het punt waar de baan heen wijst
    // in plaats van een losse versiering. Blijft binnen beeld op elke breedte.
    const entryX = Math.min(wrect.width - 34, Math.max(wrect.width * 0.72, G.x));
    // Asymmetrisch zoals een echte shuttlebaan: de klim beslaat ruim de helft
    // van de vrije breedte, de val is korter en dus steiler.
    const hangX = K.x + (entryX - K.x) * 0.56;

    core.setAttribute(
      'd',
      narrow
        ? [
            `M ${K.x} ${K.y}`,
            // lancering: steil uit de kurk, pas laat uitvlakkend — dat maakt de
            // top een hangmoment in plaats van een regenboog
            `C ${K.x + 24} ${K.y - (K.y - hangY) * 0.66}, ${hangX - 74} ${hangY}, ${hangX} ${hangY}`,
            // de val: kort over de top, dan bijna verticaal de rode band in
            `C ${hangX + 52} ${hangY}, ${entryX} ${Math.min(hangY + 44, ribbonTop)}, ${entryX} ${ribbonTop + 18}`,
            // binnen de band (rood op rood) steekt hij onzichtbaar over naar de rail
            `C ${entryX} ${ribbonBottom - 20}, ${railX} ${ribbonTop + 20}, ${railX} ${ribbonBottom + 24}`,
            `L ${railX} ${J.y}`,
            // de rail verlaten richting slot: op mobiel blijft hij in de marge
            `C ${railX} ${J.y + 200}, ${endX} ${endingTop - 200}, ${endX} ${endingTop}`,
          ].join(' ')
        : [
            `M ${K.x} ${K.y}`,
            `C ${K.x + dx * 0.185} ${K.y - dy * 0.466}, ${K.x + dx * 0.43} ${K.y - dy * 0.862}, ${G.x} ${G.y}`,
            `C ${G.x + 90} ${G.y + 150}, ${railX} ${railStart - 320}, ${railX} ${railStart}`,
            `L ${railX} ${J.y}`,
            `C ${railX} ${J.y + 260}, ${endX} ${endingTop - 220}, ${endX} ${endingTop}`,
          ].join(' '),
    );

    // Staart in slot-lokale coördinaten: verticaal binnenkomen, landen op de foto
    const frect = photo.getBoundingClientRect();
    // Op mobiel is de foto breed en laag: dan wat dieper landen, anders komt de
    // staart op de schuine snede van de clip-path uit i.p.v. óp de foto.
    const landX = frect.left - srect.left + (narrow ? 64 : 48);
    const landY = frect.top - srect.top + (narrow ? Math.min(96, frect.height * 0.38) : 40);
    const tailX = endX + wrect.left - srect.left;
    if (narrow) {
      // Op mobiel staat de foto ónder de tekst: eerst rechtlijnig door de marge
      // langs kop, tekst en knoppen, en pas daaronder inbuigen naar de foto.
      const buttons = document.getElementById(IDS.endingButtons);
      const free = buttons ? buttons.getBoundingClientRect().bottom - srect.top + 16 : landY - 120;
      const bend = Math.min(Math.max(free, landY * 0.5), landY - 40);
      tail.setAttribute('d', `M ${tailX} 0 L ${tailX} ${bend} C ${tailX} ${bend + (landY - bend) * 0.6}, ${landX - 60} ${landY}, ${landX} ${landY}`);
    } else {
      tail.setAttribute('d', `M ${tailX} 0 C ${tailX} ${landY * 0.7}, ${landX - 120} ${landY - 40}, ${landX} ${landY}`);
    }

    coreLength = core.getTotalLength();
    tailLength = tail.getTotalLength();
    samples = [];
    for (let i = 0; i <= 240; i++) {
      const len = (coreLength * i) / 240;
      samples.push({ y: core.getPointAtLength(len).y, len });
    }
    for (let i = 0; i <= 40; i++) {
      const len = (tailLength * i) / 40;
      samples.push({ y: endingTop + tail.getPointAtLength(len).y, len: coreLength + len });
    }
    if (reducedMotion) {
      core.style.strokeDasharray = tail.style.strokeDasharray = 'none';
      core.style.strokeDashoffset = tail.style.strokeDashoffset = '0';
    } else {
      core.style.strokeDasharray = String(coreLength + 2);
      tail.style.strokeDasharray = String(tailLength + 2);
      drawThread();
    }
  }

  function drawThread() {
    if (!wrapper || !core || !tail || !samples.length) return;
    // Tot net boven de onderrand: het diepste punt van de baan is de kurk, en
    // die staat op mobiel onderaan het eerste scherm. Met een ruimere marge
    // (0.85 van de hoogte) viel de lancering op veel toestellen buiten beeld en
    // bleef de draad onzichtbaar tot je scrolde.
    const visibleUntil = -wrapper.getBoundingClientRect().top + window.innerHeight - 32;
    let len = 0;
    for (const m of samples) {
      if (m.y > visibleUntil) break;
      len = m.len;
    }
    core.style.strokeDashoffset = String(Math.max(0, coreLength - len));
    tail.style.strokeDashoffset = String(Math.max(0, tailLength - Math.max(0, len - coreLength)));
  }

  let scrollTick = false;
  window.addEventListener(
    'scroll',
    () => {
      if (reducedMotion || scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        drawThread();
        scrollTick = false;
      });
    },
    { passive: true },
  );
  let rebuildTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(buildThread, 200);
  });
  if (document.readyState === 'complete') buildThread();
  else window.addEventListener('load', buildThread);

  return { rebuild: buildThread };
}
