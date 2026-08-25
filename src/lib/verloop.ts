/**
 * Klassementsverloop als inline SVG.
 *
 * Vervangt ApexCharts (263 kB gzip voor één lijn). De vorm is bewust smal: één
 * reeks, tijd op x, ranking op y met de as omgekeerd — rank 1 hoort bovenaan.
 *
 * Kleur komt uit de wereld zelf: elke laag draagt zijn kleur via een Tailwind
 * text-* klasse op de <g> in het sjabloon, en de vormen hieronder tekenen met
 * currentColor. Zo staat er geen enkele hex in deze module en volgt de grafiek
 * de tokens uit global.css — precies wat met ApexCharts niet kon.
 */

export interface VerloopPunt {
  number: number;
  rank: number;
}

const NS = 'http://www.w3.org/2000/svg';
const BEWEEGT = matchMedia('(prefers-reduced-motion: no-preference)').matches;

function vorm<K extends keyof SVGElementTagNameMap>(
  naam: K,
  attributen: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const knoop = document.createElementNS(NS, naam);
  for (const [sleutel, waarde] of Object.entries(attributen)) knoop.setAttribute(sleutel, String(waarde));
  return knoop;
}

/** Ronde stap (1, 2, 5, 10, 20 …) zodat de as-waarden leesbare getallen blijven. */
function netteStap(ruw: number): number {
  if (!(ruw > 0)) return 1;
  const macht = 10 ** Math.floor(Math.log10(ruw));
  const genormaliseerd = ruw / macht;
  // Naar de dichtstbijzijnde ronde stap, niet naar boven: een gewenste stap van 22
  // hoort 20 te worden. Naar boven afronden gaf 50, en dus nog maar twee as-waarden.
  const stap = genormaliseerd < 1.5 ? 1 : genormaliseerd < 3 ? 2 : genormaliseerd < 7 ? 5 : 10;
  return Math.max(1, Math.round(stap * macht));
}

/**
 * Het domein volgt de data, niet de volledige ledenlijst. Een speler die tussen
 * 68 en 81 schommelt kreeg bij een as van 1 tot 81 een vlakke lijn tegen de
 * onderrand: 83% van het vlak leeg. Hier ademt het verloop het hele vlak.
 */
function schaal(ranks: number[]) {
  let laagste = Math.min(...ranks);
  let hoogste = Math.max(...ranks);
  if (laagste === hoogste) {
    laagste -= 1;
    hoogste += 1;
  }
  // Het domein is de data plus wat lucht — níét afgerond op de tickstap. Dat laatste
  // zou bij ranks 68–99 een as van 60 tot 110 opleveren: een vijfde van het vlak leeg.
  // De ticks zijn wél ronde getallen; ze vallen gewoon binnen het domein.
  const marge = Math.max(1, Math.round((hoogste - laagste) * 0.08));
  const van = Math.max(1, laagste - marge);
  const tot = hoogste + marge;
  const stap = netteStap((tot - van) / 4);
  const waarden: number[] = [];
  for (let tick = Math.max(stap, Math.ceil(van / stap) * stap); tick <= tot; tick += stap) waarden.push(tick);
  return { van, tot, waarden };
}

/** Welke speeldagen krijgen een label: nooit dichter dan ~26px op elkaar, eerste en laatste altijd. */
function labelIndexen(aantal: number, breedte: number): Set<number> {
  const om = Math.max(1, Math.ceil((aantal * 26) / Math.max(1, breedte)));
  const getoond = new Set<number>();
  for (let i = 0; i < aantal; i += om) getoond.add(i);
  const laatste = aantal - 1;
  for (const i of [...getoond]) if (laatste - i < om && i !== laatste) getoond.delete(i);
  getoond.add(laatste);
  return getoond;
}

export function tekenVerloop(figuur: HTMLElement, historiek: VerloopPunt[]): void {
  const svg = figuur.querySelector('svg')!;
  const laag = (naam: string) => figuur.querySelector<SVGGElement>(`[data-laag="${naam}"]`)!;
  const tooltip = figuur.querySelector<HTMLElement>('[data-tooltip]')!;
  const melding = figuur.querySelector<HTMLElement>('[data-melding]')!;
  const tooltipWaarde = tooltip.querySelector<HTMLElement>('[data-tooltip-waarde]')!;
  const tooltipBijschrift = tooltip.querySelector<HTMLElement>('[data-tooltip-bijschrift]')!;

  const ranks = historiek.map((punt) => punt.rank);
  const eerste = historiek[0];
  const nu = historiek[historiek.length - 1];
  const beste = Math.min(...ranks);
  // De laatste keer dat de speler zijn beste plaats haalde: dat is de speeldag die telt.
  const besteIndex = ranks.lastIndexOf(beste);
  svg.setAttribute(
    'aria-label',
    `Klassementsverloop over ${historiek.length} speeldagen: van ${eerste.rank} op speeldag ${eerste.number} ` +
      `naar ${nu.rank} op speeldag ${nu.number}. Beste plaats: ${beste}.`,
  );

  let getekend = false;
  let actief = -1;
  let punten: { x: number; y: number }[] = [];
  let vlakBoven = 0;
  let vlakOnder = 0;
  let laatsteBreedte = 0;

  function teken() {
    const breedte = Math.max(280, figuur.clientWidth);
    // De ResizeObserver vuurt ook meteen bij observe(); zonder deze poort zou die
    // tweede tekening de net gestarte lijnanimatie weggooien.
    if (breedte === laatsteBreedte) return;
    laatsteBreedte = breedte;
    const hoogte = breedte < 480 ? 240 : 320;
    // Boven is ruim: de beste plaats is per definitie het hoogste punt, en zijn
    // label moet erboven passen zonder op de bovenste as-waarde te gaan staan.
    const marge = { boven: 46, rechts: 48, onder: 46, links: 32 };
    const vlakBreedte = breedte - marge.links - marge.rechts;
    const vlakHoogte = hoogte - marge.boven - marge.onder;
    const onder = marge.boven + vlakHoogte;
    vlakBoven = marge.boven;
    vlakOnder = onder;

    svg.setAttribute('viewBox', `0 0 ${breedte} ${hoogte}`);
    svg.setAttribute('height', String(hoogte));

    const { van, tot, waarden } = schaal(ranks);
    // Omgekeerd: de laagste rank (de beste plaats) hoort bovenaan.
    const y = (rank: number) => marge.boven + ((rank - van) / (tot - van)) * vlakHoogte;
    const x = (index: number) =>
      marge.links + (historiek.length === 1 ? vlakBreedte / 2 : (index / (historiek.length - 1)) * vlakBreedte);
    punten = historiek.map((punt, index) => ({ x: x(index), y: y(punt.rank) }));

    const grid = laag('grid');
    const as = laag('as');
    const vlak = laag('vlak');
    const labels = laag('labels');
    for (const groep of [grid, as, vlak, labels]) groep.replaceChildren();

    // Hairlines, solide en één stap van de grond: het raster mag nooit meelezen.
    for (const waarde of waarden) {
      grid.append(
        vorm('line', {
          x1: marge.links,
          x2: marge.links + vlakBreedte,
          y1: y(waarde),
          y2: y(waarde),
          stroke: 'currentColor',
          'stroke-width': 1,
        }),
      );
      const tick = vorm('text', { x: marge.links - 8, y: y(waarde) + 4, 'text-anchor': 'end', fill: 'currentColor' });
      tick.textContent = String(waarde);
      as.append(tick);
    }

    const zichtbaar = labelIndexen(historiek.length, vlakBreedte);
    for (const [index, punt] of historiek.entries()) {
      if (!zichtbaar.has(index)) continue;
      const tick = vorm('text', { x: x(index), y: onder + 18, 'text-anchor': 'middle', fill: 'currentColor' });
      tick.textContent = String(punt.number);
      as.append(tick);
    }

    const kop = vorm('text', { x: 0, y: 10, fill: 'currentColor', class: 'stem-baan' });
    kop.textContent = 'Ranking';
    const voet = vorm('text', {
      x: marge.links + vlakBreedte / 2,
      y: onder + 38,
      'text-anchor': 'middle',
      fill: 'currentColor',
      class: 'stem-baan',
    });
    voet.textContent = 'Speeldag';
    as.append(kop, voet);

    // De lijn: 2px, ronde verbindingen — dezelfde vluchtdraad, hier met echte data.
    const lijn = vorm('path', {
      d: punten.map((punt, index) => `${index === 0 ? 'M' : 'L'}${punt.x.toFixed(1)} ${punt.y.toFixed(1)}`).join(' '),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    vlak.append(lijn);

    // Meetpuntbollen met een ring in de grondkleur, zodat ze los blijven van de lijn.
    for (const [index, punt] of punten.entries()) {
      vlak.append(
        vorm('circle', {
          cx: punt.x,
          cy: punt.y,
          r: index === punten.length - 1 ? 5 : 4,
          fill: 'currentColor',
          stroke: 'var(--color-veer-50)',
          'stroke-width': 2,
        }),
      );
    }

    // Selectief labelen: het eindpunt en de beste plaats. Nooit een cijfer per punt —
    // de as, de tooltip en de tabel dragen de rest.
    const eindY = Math.min(punten.at(-1)!.y, onder - 13);
    const eind = vorm('text', {
      x: marge.links + vlakBreedte + 12,
      y: eindY + 4,
      fill: 'currentColor',
      class: 'stem-cijfer text-sm',
    });
    eind.textContent = String(nu.rank);
    const eindBijschrift = vorm('text', {
      x: marge.links + vlakBreedte + 12,
      y: eindY + 17,
      fill: 'currentColor',
      class: 'stem-baan opacity-60',
    });
    eindBijschrift.textContent = 'nu';
    labels.append(eind, eindBijschrift);

    // Alleen als de beste plaats niet tegen het eindpunt aan ligt — anders overlappen de labels.
    if (besteIndex < historiek.length - 2) {
      const punt = punten[besteIndex];
      // Aan de randen zou een gecentreerd label buiten het vlak steken — over de
      // as-waarden links, of over de rand rechts. Anker het dan aan het punt zelf.
      const anker = punt.x < marge.links + 20 ? 'start' : punt.x > marge.links + vlakBreedte - 20 ? 'end' : 'middle';
      const bal = vorm('text', {
        x: punt.x,
        y: punt.y - 14,
        'text-anchor': anker,
        fill: 'currentColor',
        class: 'stem-cijfer text-sm',
      });
      bal.textContent = String(beste);
      const bijschrift = vorm('text', {
        x: punt.x,
        y: punt.y - 26,
        'text-anchor': anker,
        fill: 'currentColor',
        class: 'stem-baan opacity-60',
      });
      bijschrift.textContent = 'beste';
      labels.append(bijschrift, bal);
    }

    if (BEWEEGT && !getekend) {
      const lengte = lijn.getTotalLength();
      lijn.animate(
        [
          { strokeDasharray: `${lengte}`, strokeDashoffset: `${lengte}` },
          { strokeDasharray: `${lengte}`, strokeDashoffset: '0' },
        ],
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
      for (const [index, bol] of [...vlak.querySelectorAll('circle')].entries()) {
        bol.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], {
          duration: 500 + (index / punten.length) * 600,
          easing: 'linear',
        });
      }
    }
    getekend = true;

    // Het raakvlak is ruimer dan de lijn: mikken op een speeldag, niet op 2px inkt.
    laag('raakvlak').replaceChildren(
      vorm('rect', {
        x: marge.links - 12,
        y: marge.boven - 12,
        width: vlakBreedte + 24,
        height: vlakHoogte + 24,
        fill: 'transparent',
      }),
    );
    if (actief >= 0) wijs(actief);
    else laag('kruis').replaceChildren();
  }

  /** Het kruisdraad zoekt de x: de lezer mikt op een speeldag, nooit op een lijn van 2px. */
  function wijs(index: number) {
    actief = Math.min(Math.max(index, 0), historiek.length - 1);
    const punt = punten[actief];
    laag('kruis').replaceChildren(
      vorm('line', { x1: punt.x, x2: punt.x, y1: vlakBoven, y2: vlakOnder, stroke: 'currentColor', 'stroke-width': 1 }),
      vorm('circle', { cx: punt.x, cy: punt.y, r: 8, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
    );

    tooltipWaarde.textContent = `Ranking ${historiek[actief].rank}`;
    tooltipBijschrift.textContent = `Speeldag ${historiek[actief].number}`;
    tooltip.hidden = false;
    // Onder 280px container-breedte schaalt de viewBox mee; reken dan terug naar CSS-pixels.
    const schaalFactor = svg.clientWidth / laatsteBreedte || 1;
    // Bij de eerste en laatste speeldag zou een gecentreerde tooltip half buiten
    // het scherm hangen; klem hem binnen de figuur (hij is -translate-x-1/2).
    const halve = tooltip.offsetWidth / 2;
    const grens = figuur.clientWidth;
    tooltip.style.left = `${Math.min(Math.max(punt.x * schaalFactor, halve), Math.max(halve, grens - halve))}px`;
    tooltip.style.top = `${punt.y * schaalFactor}px`;
    melding.textContent = `Speeldag ${historiek[actief].number}: ranking ${historiek[actief].rank}.`;
  }

  function verberg() {
    actief = -1;
    laag('kruis').replaceChildren();
    tooltip.hidden = true;
    melding.textContent = '';
  }

  function dichtstbij(muisX: number) {
    let beste = 0;
    for (let index = 1; index < punten.length; index++) {
      if (Math.abs(punten[index].x - muisX) < Math.abs(punten[beste].x - muisX)) beste = index;
    }
    return beste;
  }

  svg.addEventListener('pointermove', (gebeurtenis) => {
    const kader = svg.getBoundingClientRect();
    wijs(dichtstbij(((gebeurtenis.clientX - kader.left) / kader.width) * laatsteBreedte));
  });
  svg.addEventListener('pointerleave', verberg);
  svg.addEventListener('focus', () => wijs(actief < 0 ? historiek.length - 1 : actief));
  svg.addEventListener('blur', verberg);
  svg.addEventListener('keydown', (gebeurtenis) => {
    const sprong: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -historiek.length,
      End: historiek.length,
    };
    const stap = sprong[gebeurtenis.key];
    if (stap === undefined) return;
    gebeurtenis.preventDefault();
    wijs((actief < 0 ? historiek.length - 1 : actief) + stap);
  });

  teken();
  new ResizeObserver(teken).observe(figuur);
}
