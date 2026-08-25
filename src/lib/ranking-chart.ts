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

export interface RankingPoint {
  number: number;
  rank: number;
}

const NS = 'http://www.w3.org/2000/svg';
const MOTION_OK = matchMedia('(prefers-reduced-motion: no-preference)').matches;

function shape<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

/** Ronde stap (1, 2, 5, 10, 20 …) zodat de as-waarden leesbare getallen blijven. */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  // Naar de dichtstbijzijnde ronde stap, niet naar boven: een gewenste stap van 22
  // hoort 20 te worden. Naar boven afronden gaf 50, en dus nog maar twee as-waarden.
  const step = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return Math.max(1, Math.round(step * power));
}

/**
 * Het domein volgt de data, niet de volledige ledenlijst. Een speler die tussen
 * 68 en 81 schommelt kreeg bij een as van 1 tot 81 een vlakke lijn tegen de
 * onderrand: 83% van het vlak leeg. Hier ademt het verloop het hele vlak.
 */
function scale(ranks: number[]) {
  let lowest = Math.min(...ranks);
  let highest = Math.max(...ranks);
  if (lowest === highest) {
    lowest -= 1;
    highest += 1;
  }
  // Het domein is de data plus wat lucht — níét afgerond op de tickstap. Dat laatste
  // zou bij ranks 68–99 een as van 60 tot 110 opleveren: een vijfde van het vlak leeg.
  // De ticks zijn wél ronde getallen; ze vallen gewoon binnen het domein.
  const margin = Math.max(1, Math.round((highest - lowest) * 0.08));
  const from = Math.max(1, lowest - margin);
  const to = highest + margin;
  const step = niceStep((to - from) / 4);
  const values: number[] = [];
  for (let tick = Math.max(step, Math.ceil(from / step) * step); tick <= to; tick += step) values.push(tick);
  return { from, to, values };
}

/** Welke speeldagen krijgen een label: nooit dichter dan ~26px op elkaar, eerste en laatste altijd. */
function labelIndices(count: number, width: number): Set<number> {
  const every = Math.max(1, Math.ceil((count * 26) / Math.max(1, width)));
  const shown = new Set<number>();
  for (let i = 0; i < count; i += every) shown.add(i);
  const last = count - 1;
  for (const i of [...shown]) if (last - i < every && i !== last) shown.delete(i);
  shown.add(last);
  return shown;
}

export function drawRankingChart(figure: HTMLElement, history: RankingPoint[]): void {
  const svg = figure.querySelector('svg')!;
  const layer = (name: string) => figure.querySelector<SVGGElement>(`[data-laag="${name}"]`)!;
  const tooltip = figure.querySelector<HTMLElement>('[data-tooltip]')!;
  const announcement = figure.querySelector<HTMLElement>('[data-melding]')!;
  const tooltipValue = tooltip.querySelector<HTMLElement>('[data-tooltip-waarde]')!;
  const tooltipCaption = tooltip.querySelector<HTMLElement>('[data-tooltip-bijschrift]')!;

  const ranks = history.map((point) => point.rank);
  const first = history[0];
  const now = history[history.length - 1];
  const best = Math.min(...ranks);
  // De laatste keer dat de speler zijn beste plaats haalde: dat is de speeldag die telt.
  const bestIndex = ranks.lastIndexOf(best);
  svg.setAttribute(
    'aria-label',
    `Klassementsverloop over ${history.length} speeldagen: van ${first.rank} op speeldag ${first.number} ` +
      `naar ${now.rank} op speeldag ${now.number}. Beste plaats: ${best}.`,
  );

  let drawn = false;
  let active = -1;
  let points: { x: number; y: number }[] = [];
  let plotTop = 0;
  let plotBottom = 0;
  let lastWidth = 0;

  function draw() {
    const width = Math.max(280, figure.clientWidth);
    // De ResizeObserver vuurt ook meteen bij observe(); zonder deze poort zou die
    // tweede tekening de net gestarte lijnanimatie weggooien.
    if (width === lastWidth) return;
    lastWidth = width;
    const height = width < 480 ? 240 : 320;
    // Boven is ruim: de beste plaats is per definitie het hoogste punt, en zijn
    // label moet erboven passen zonder op de bovenste as-waarde te gaan staan.
    const margin = { top: 46, right: 48, bottom: 46, left: 32 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const bottom = margin.top + plotHeight;
    plotTop = margin.top;
    plotBottom = bottom;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('height', String(height));

    const { from, to, values } = scale(ranks);
    // Omgekeerd: de laagste rank (de beste plaats) hoort bovenaan.
    const y = (rank: number) => margin.top + ((rank - from) / (to - from)) * plotHeight;
    const x = (index: number) =>
      margin.left + (history.length === 1 ? plotWidth / 2 : (index / (history.length - 1)) * plotWidth);
    points = history.map((point, index) => ({ x: x(index), y: y(point.rank) }));

    const grid = layer('grid');
    const axis = layer('as');
    const plot = layer('vlak');
    const labels = layer('labels');
    for (const group of [grid, axis, plot, labels]) group.replaceChildren();

    // Hairlines, solide en één stap van de grond: het raster mag nooit meelezen.
    for (const value of values) {
      grid.append(
        shape('line', {
          x1: margin.left,
          x2: margin.left + plotWidth,
          y1: y(value),
          y2: y(value),
          stroke: 'currentColor',
          'stroke-width': 1,
        }),
      );
      const tick = shape('text', { x: margin.left - 8, y: y(value) + 4, 'text-anchor': 'end', fill: 'currentColor' });
      tick.textContent = String(value);
      axis.append(tick);
    }

    const visible = labelIndices(history.length, plotWidth);
    for (const [index, point] of history.entries()) {
      if (!visible.has(index)) continue;
      const tick = shape('text', { x: x(index), y: bottom + 18, 'text-anchor': 'middle', fill: 'currentColor' });
      tick.textContent = String(point.number);
      axis.append(tick);
    }

    const heading = shape('text', { x: 0, y: 10, fill: 'currentColor', class: 'stem-baan' });
    heading.textContent = 'Ranking';
    const footer = shape('text', {
      x: margin.left + plotWidth / 2,
      y: bottom + 38,
      'text-anchor': 'middle',
      fill: 'currentColor',
      class: 'stem-baan',
    });
    footer.textContent = 'Speeldag';
    axis.append(heading, footer);

    // De lijn: 2px, ronde verbindingen — dezelfde vluchtdraad, hier met echte data.
    const line = shape('path', {
      d: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    plot.append(line);

    // Meetpuntbollen met een ring in de grondkleur, zodat ze los blijven van de lijn.
    for (const [index, point] of points.entries()) {
      plot.append(
        shape('circle', {
          cx: point.x,
          cy: point.y,
          r: index === points.length - 1 ? 5 : 4,
          fill: 'currentColor',
          stroke: 'var(--color-veer-50)',
          'stroke-width': 2,
        }),
      );
    }

    // Selectief labelen: het eindpunt en de beste plaats. Nooit een cijfer per punt —
    // de as, de tooltip en de tabel dragen de rest.
    const endY = Math.min(points.at(-1)!.y, bottom - 13);
    const end = shape('text', {
      x: margin.left + plotWidth + 12,
      y: endY + 4,
      fill: 'currentColor',
      class: 'stem-cijfer text-sm',
    });
    end.textContent = String(now.rank);
    const endCaption = shape('text', {
      x: margin.left + plotWidth + 12,
      y: endY + 17,
      fill: 'currentColor',
      class: 'stem-baan opacity-60',
    });
    endCaption.textContent = 'nu';
    labels.append(end, endCaption);

    // Alleen als de beste plaats niet tegen het eindpunt aan ligt — anders overlappen de labels.
    if (bestIndex < history.length - 2) {
      const point = points[bestIndex];
      // Aan de randen zou een gecentreerd label buiten het vlak steken — over de
      // as-waarden links, of over de rand rechts. Anker het dan aan het punt zelf.
      const anchor = point.x < margin.left + 20 ? 'start' : point.x > margin.left + plotWidth - 20 ? 'end' : 'middle';
      const bestLabel = shape('text', {
        x: point.x,
        y: point.y - 14,
        'text-anchor': anchor,
        fill: 'currentColor',
        class: 'stem-cijfer text-sm',
      });
      bestLabel.textContent = String(best);
      const caption = shape('text', {
        x: point.x,
        y: point.y - 26,
        'text-anchor': anchor,
        fill: 'currentColor',
        class: 'stem-baan opacity-60',
      });
      caption.textContent = 'beste';
      labels.append(caption, bestLabel);
    }

    if (MOTION_OK && !drawn) {
      const length = line.getTotalLength();
      line.animate(
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: '0' },
        ],
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
      for (const [index, dot] of [...plot.querySelectorAll('circle')].entries()) {
        dot.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], {
          duration: 500 + (index / points.length) * 600,
          easing: 'linear',
        });
      }
    }
    drawn = true;

    // Het raakvlak is ruimer dan de lijn: mikken op een speeldag, niet op 2px inkt.
    layer('raakvlak').replaceChildren(
      shape('rect', {
        x: margin.left - 12,
        y: margin.top - 12,
        width: plotWidth + 24,
        height: plotHeight + 24,
        fill: 'transparent',
      }),
    );
    if (active >= 0) highlight(active);
    else layer('kruis').replaceChildren();
  }

  /** Het kruisdraad zoekt de x: de lezer mikt op een speeldag, nooit op een lijn van 2px. */
  function highlight(index: number) {
    active = Math.min(Math.max(index, 0), history.length - 1);
    const point = points[active];
    layer('kruis').replaceChildren(
      shape('line', { x1: point.x, x2: point.x, y1: plotTop, y2: plotBottom, stroke: 'currentColor', 'stroke-width': 1 }),
      shape('circle', { cx: point.x, cy: point.y, r: 8, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
    );

    tooltipValue.textContent = `Ranking ${history[active].rank}`;
    tooltipCaption.textContent = `Speeldag ${history[active].number}`;
    tooltip.hidden = false;
    // Onder 280px container-breedte schaalt de viewBox mee; reken dan terug naar CSS-pixels.
    const scaleFactor = svg.clientWidth / lastWidth || 1;
    // Bij de eerste en laatste speeldag zou een gecentreerde tooltip half buiten
    // het scherm hangen; klem hem binnen de figuur (hij is -translate-x-1/2).
    const half = tooltip.offsetWidth / 2;
    const limit = figure.clientWidth;
    tooltip.style.left = `${Math.min(Math.max(point.x * scaleFactor, half), Math.max(half, limit - half))}px`;
    tooltip.style.top = `${point.y * scaleFactor}px`;
    announcement.textContent = `Speeldag ${history[active].number}: ranking ${history[active].rank}.`;
  }

  function hide() {
    active = -1;
    layer('kruis').replaceChildren();
    tooltip.hidden = true;
    announcement.textContent = '';
  }

  function nearest(pointerX: number) {
    let best = 0;
    for (let index = 1; index < points.length; index++) {
      if (Math.abs(points[index].x - pointerX) < Math.abs(points[best].x - pointerX)) best = index;
    }
    return best;
  }

  svg.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    highlight(nearest(((event.clientX - box.left) / box.width) * lastWidth));
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => highlight(active < 0 ? history.length - 1 : active));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (event) => {
    const jump: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -history.length,
      End: history.length,
    };
    const step = jump[event.key];
    if (step === undefined) return;
    event.preventDefault();
    highlight((active < 0 ? history.length - 1 : active) + step);
  });

  draw();
  new ResizeObserver(draw).observe(figure);
}
