// De vluchtdraad op de homepage: één doorlopende rode lijn van kurk tot slot,
// met de scroll getekend. De pluim staat statisch in de hero (puur CSS).

// Alle DOM-ankers van de draad op één plek: hernoem je een id in index.astro,
// dan is dit de inventaris die mee moet.
const IDS = {
  wrapper: 'page',
  core: 'thread-core',
  tail: 'thread-tail',
  cork: 'cork-cta',
  glyph: 'shuttle-glyph',
  hours: 'play-hours-list',
  year: 'dot-1987',
  historyLink: 'history-link',
  closing: 'closing-section',
  photo: 'closing-photo',
  intraSection: 'intra-section',
  intraDot: 'dot-intra',
  band: 'red-band',
  closingButtons: 'closing-buttons',
  nextMoment: 'next-moment',
} as const;

// Onder md staat alle tekst in één volle kolom (px-4): de diagonaal van kurk
// naar de shuttle zou dwars door koppen en lopende tekst snijden. In plaats van
// eromheen te sluipen langs de schermranden — dat leest als een kader, niet als
// een vlucht — vliegt de baan daar dezelfde parabool in miniatuur: uit de kurk
// omhoog, een hangmoment in de vrije band onder de tekst, en rechts weer neer
// de rode band in, waar rood op rood de oversteek naar de rail verbergt.
const NARROW_BELOW = 768;
// Baan in de buitenmarge: de tekstkolom begint op px-4 (16px), de draad (4px)
// blijft er met zijn hele dikte links van.
const MARGIN = 7;

function centerOf(el: Element, wrect: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left - wrect.left + r.width / 2, y: r.top - wrect.top + r.height / 2 };
}

/**
 * Meet de baan uit in monsters (paginahoogte → afgelegde lengte). De staart
 * leeft in slot-lokale coördinaten, dus schuift `closingTop` erbij.
 */
function measurePath(core: SVGPathElement, tail: SVGPathElement, closingTop: number) {
  const coreLength = core.getTotalLength();
  const tailLength = tail.getTotalLength();
  const samples: { y: number; len: number }[] = [];
  for (let i = 0; i <= 240; i++) {
    const len = (coreLength * i) / 240;
    samples.push({ y: core.getPointAtLength(len).y, len });
  }
  for (let i = 0; i <= 40; i++) {
    const len = (tailLength * i) / 40;
    samples.push({ y: closingTop + tail.getPointAtLength(len).y, len: coreLength + len });
  }
  return { coreLength, tailLength, samples };
}

/**
 * Start de landing-animatie (.flight → .landed) en bouwt de vluchtdraad.
 * Geeft `rebuild` terug zodat dataloaders de draad kunnen herberekenen wanneer
 * secties van hoogte veranderen of dichtklappen.
 */
export function initThread(): { rebuild: () => void } {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('landed');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 },
  );
  document.querySelectorAll('.flight').forEach((el) => observer.observe(el));

  const wrapper = document.getElementById(IDS.wrapper);
  const core = document.getElementById(IDS.core) as SVGPathElement | null;
  const tail = document.getElementById(IDS.tail) as SVGPathElement | null;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Hoogtes langs de baan (y → afgelegde lengte): per scrollstand weten we zo
  // hoeveel draad er getekend mag zijn.
  let samples: { y: number; len: number }[] = [];
  let coreLength = 0;
  let tailLength = 0;
  let totalLength = 0;

  function buildThread() {
    const cork = document.getElementById(IDS.cork);
    const glyph = document.getElementById(IDS.glyph);
    const hours = document.getElementById(IDS.hours);
    const year = document.getElementById(IDS.year);
    const historyLink = document.getElementById(IDS.historyLink);
    const closing = document.getElementById(IDS.closing);
    const photo = document.getElementById(IDS.photo);
    if (!wrapper || !core || !tail || !cork || !glyph || !hours || !year || !historyLink || !closing || !photo) return;

    const wrect = wrapper.getBoundingClientRect();
    const K = centerOf(cork, wrect);
    const G = centerOf(glyph, wrect);
    const urect = hours.getBoundingClientRect();
    const railX = urect.left - wrect.left + 6;
    const hoursTop = urect.top - wrect.top + 8;
    // Als de intra top-10 zichtbaar is, landt de draad daar eerst op de rail
    const intraSection = document.getElementById(IDS.intraSection);
    const intraDot = document.getElementById(IDS.intraDot);
    const railStart =
      intraSection && intraDot && !intraSection.classList.contains('hidden')
        ? centerOf(intraDot, wrect).y
        : hoursTop;
    const J = centerOf(year, wrect);
    const historyClearY = historyLink.getBoundingClientRect().bottom - wrect.top + 10;
    const srect = closing.getBoundingClientRect();
    const closingTop = srect.top - wrect.top;
    const narrow = wrect.width < NARROW_BELOW;
    const endX = narrow ? MARGIN : wrect.width * 0.52;
    const dx = G.x - K.x;
    const dy = K.y - G.y;

    // De rode band vangt de oversteek van rechter- naar linkermarge; zonder
    // band (of zonder id) valt de draad terug op de ruimte boven de rail.
    const bandEl = document.getElementById(IDS.band);
    const brect = bandEl?.getBoundingClientRect();
    const bandTop = brect ? brect.top - wrect.top : railStart - 360;
    const bandBottom = brect ? brect.bottom - wrect.top : railStart - 120;
    // De val na het hangmoment: x blijft bij de pluim, y duikt de rode band in.
    const dropX = Math.min(wrect.width - 34, Math.max(wrect.width * 0.72, G.x));

    core.setAttribute(
      'd',
      narrow
        ? [
            `M ${K.x} ${K.y}`,
            // Mini-parabool in de buitenmarge; eindpunt is het midden van de pluim (G).
            `C ${K.x + 24} ${K.y - (K.y - G.y) * 0.66}, ${G.x - 74} ${G.y}, ${G.x} ${G.y}`,
            // de val: kort over de top, dan bijna verticaal de rode band in
            `C ${G.x + 52} ${G.y}, ${dropX} ${Math.min(G.y + 44, bandTop)}, ${dropX} ${bandTop + 18}`,
            // binnen de band (rood op rood) steekt hij onzichtbaar over naar de rail
            `C ${dropX} ${bandBottom - 20}, ${railX} ${bandTop + 20}, ${railX} ${bandBottom + 24}`,
            `L ${railX} ${J.y}`,
            // Eerst langs de geschiedenislink, daarna de rail verlaten richting slot.
            `L ${railX} ${historyClearY}`,
            `C ${railX} ${historyClearY + 200}, ${endX} ${closingTop - 200}, ${endX} ${closingTop}`,
          ].join(' ')
        : [
            `M ${K.x} ${K.y}`,
            `C ${K.x + dx * 0.185} ${K.y - dy * 0.466}, ${K.x + dx * 0.43} ${K.y - dy * 0.862}, ${G.x} ${G.y}`,
            `C ${G.x + 90} ${G.y + 150}, ${railX} ${railStart - 320}, ${railX} ${railStart}`,
            `L ${railX} ${J.y}`,
            `L ${railX} ${historyClearY}`,
            `C ${railX} ${historyClearY + 200}, ${endX} ${closingTop - 220}, ${endX} ${closingTop}`,
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
      const buttons = document.getElementById(IDS.closingButtons);
      const free = buttons ? buttons.getBoundingClientRect().bottom - srect.top + 16 : landY - 120;
      const bend = Math.min(Math.max(free, landY * 0.5), landY - 40);
      tail.setAttribute('d', `M ${tailX} 0 L ${tailX} ${bend} C ${tailX} ${bend + (landY - bend) * 0.6}, ${landX - 60} ${landY}, ${landX} ${landY}`);
    } else {
      tail.setAttribute('d', `M ${tailX} 0 C ${tailX} ${landY * 0.7}, ${landX - 120} ${landY - 40}, ${landX} ${landY}`);
    }

    ({ coreLength, tailLength, samples } = measurePath(core, tail, closingTop));
    totalLength = coreLength + tailLength;

    if (calm) {
      core.style.strokeDasharray = tail.style.strokeDasharray = 'none';
      core.style.strokeDashoffset = tail.style.strokeDashoffset = '0';
    } else {
      // Eén streep zo lang als het pad: de offset schuift hem naar binnen.
      core.style.strokeDasharray = String(coreLength + 2);
      tail.style.strokeDasharray = String(tailLength + 2);
      drawThread();
    }
  }

  /**
   * Tekent de draad tot waar de scroll staat: alles boven de leeslijn (85% van
   * het beeld) is gevlogen, de rest wacht.
   */
  function drawThread() {
    if (!wrapper || !core || !tail || !samples.length) return;
    const visibleUntil = -wrapper.getBoundingClientRect().top + window.innerHeight * 0.85;
    let len = 0;
    for (const s of samples) {
      if (s.y > visibleUntil) break;
      len = s.len;
    }
    // De hero komt leeg binnen. Het kurkpunt staat in het eerste beeld, dus de
    // leeslijn hierboven zou de hele klim al bij scrollstand 0 tekenen; deze
    // poort laat de vlucht pas lopen naarmate je scrollt en staat na één beeld
    // scrollen helemaal open, waarna de leeslijn weer alleen beslist.
    len = Math.min(len, totalLength * Math.min(1, window.scrollY / window.innerHeight));
    core.style.strokeDashoffset = String(Math.max(0, coreLength - len));
    tail.style.strokeDashoffset = String(Math.max(0, tailLength - Math.max(0, len - coreLength)));
  }

  let scrollTick = false;
  window.addEventListener(
    'scroll',
    () => {
      if (calm || scrollTick) return;
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
