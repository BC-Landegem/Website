/**
 * Verloop van één speler als inline SVG.
 *
 * Vervangt ApexCharts (263 kB gzip voor één lijn). De figuur draagt twee
 * verhalen die niet op één as passen:
 *
 * - **Plaats** loopt van 1 tot ruim honderd, omgekeerd (1 hoort bovenaan), en is
 *   waar de meeste leden hun seizoen aan afmeten.
 * - **Gemiddelde** loopt in tienden tussen 15 en 21 en deelt zijn eenheid met de
 *   dagscore, zodat de rekenregel uit "zo werkt het" zichtbaar wordt: de lijn is
 *   niets anders dan het lopend gemiddelde van de losse punten erachter.
 *
 * Ze samen in één vlak persen zou één van de twee onleesbaar maken, dus schakelt
 * de pagina ertussen en past de as zich aan. `setMode()` hertekent zonder de
 * ResizeObserver of de luisteraars opnieuw op te hangen.
 *
 * Kleur komt uit de wereld zelf: elke laag draagt zijn kleur via een Tailwind
 * text-* klasse op de <g> in het sjabloon, en de vormen hieronder tekenen met
 * currentColor. Zo staat er geen enkele hex in deze module en volgt de grafiek
 * de tokens uit global.css — precies wat met ApexCharts niet kon.
 */

export interface ProgressionPoint {
  number: number;
  average: number;
  /** Wat die avond opbracht. `null` bij uitgeloot: die speeldag telt niet mee. */
  day_score: number | null;
  /** `null` voor wie die speeldag niet in het klassement stond. */
  rank: number | null;
}

export type ProgressionMode = 'rank' | 'average';

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

/** Twee decimalen met een komma, zoals de rest van de site cijfers zet. */
const decimal = (value: number) => value.toFixed(2).replace('.', ',');

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
 * Het domein volgt de data, niet het volledige bereik. Een speler die tussen 68
 * en 81 schommelt kreeg bij een as van 1 tot 81 een vlakke lijn tegen de
 * onderrand: 83% van het vlak leeg. Hier ademt het verloop het hele vlak.
 */
function rankScale(values: number[]) {
  let lowest = Math.min(...values);
  let highest = Math.max(...values);
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
  const ticks: number[] = [];
  for (let tick = Math.max(step, Math.ceil(from / step) * step); tick <= to; tick += step) {
    ticks.push(tick);
  }
  return { from, to, ticks, label: (value: number) => String(value) };
}

/** Zelfde idee, maar een gemiddelde beweegt in tienden en niet in eenheden. */
function averageScale(values: number[]) {
  let lowest = Math.min(...values);
  let highest = Math.max(...values);
  if (lowest === highest) {
    lowest -= 0.5;
    highest += 0.5;
  }
  const margin = Math.max(0.15, (highest - lowest) * 0.08);
  const from = Math.max(0, lowest - margin);
  const to = highest + margin;
  // Hele punten als as-waarde. Halve punten pas wanneer het bereik zo smal is
  // dat er anders maar één streep in beeld staat.
  const step = to - from > 3.5 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let tick = Math.ceil(from / step) * step; tick <= to; tick += step) {
    ticks.push(Number(tick.toFixed(1)));
  }
  const label = (value: number) =>
    step < 1 ? decimal(value).replace(',00', '') : String(Math.round(value));
  return { from, to, ticks, label };
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

/** Hoeveel speeldagen elke modus kan tonen; onder de twee is er geen verloop. */
export function progressionCounts(history: ProgressionPoint[]) {
  return {
    rank: history.filter((pt) => pt.rank !== null).length,
    average: history.length,
  };
}

export function drawProgression(
  figure: HTMLElement,
  history: ProgressionPoint[],
  initial: ProgressionMode = 'rank',
): { setMode: (mode: ProgressionMode) => void } {
  const svg = figure.querySelector('svg')!;
  const layer = (name: string) => figure.querySelector<SVGGElement>(`[data-layer="${name}"]`)!;
  const tooltip = figure.querySelector<HTMLElement>('[data-tooltip]')!;
  const message = figure.querySelector<HTMLElement>('[data-message]')!;
  const tooltipValue = tooltip.querySelector<HTMLElement>('[data-tooltip-value]')!;
  const tooltipCaption = tooltip.querySelector<HTMLElement>('[data-tooltip-caption]')!;

  let mode: ProgressionMode = initial;
  /** De rijen die in deze modus getekend worden; zonder rank valt een rij weg. */
  let rows: ProgressionPoint[] = [];
  let values: number[] = [];

  let drawn = false;
  let active = -1;
  let points: { x: number; y: number }[] = [];
  let areaTop = 0;
  let areaBottom = 0;
  let lastWidth = 0;

  function prepare() {
    rows = mode === 'rank' ? history.filter((pt) => pt.rank !== null) : history;
    values = rows.map((pt) => (mode === 'rank' ? pt.rank! : pt.average));

    const first = rows[0];
    const latest = rows[rows.length - 1];
    if (!first || !latest) return;
    svg.setAttribute(
      'aria-label',
      mode === 'rank'
        ? `Klassementsverloop over ${rows.length} speeldagen: van plaats ${first.rank} op speeldag ${first.number} naar ${latest.rank} op speeldag ${latest.number}. Beste plaats: ${Math.min(...values)}.`
        : `Verloop van het gemiddelde over ${rows.length} speeldagen: van ${decimal(first.average)} op speeldag ${first.number} naar ${decimal(latest.average)} op speeldag ${latest.number}. Beste: ${decimal(Math.max(...values))}.`,
    );
  }

  function draw() {
    const width = Math.max(280, figure.clientWidth);
    const height = width < 480 ? 240 : 320;
    if (!rows.length) return;

    // Boven is ruim: het beste punt is per definitie het hoogste, en zijn label
    // moet erboven passen zonder op de bovenste as-waarde te gaan staan.
    const margin = { top: 46, right: 48, bottom: 46, left: mode === 'rank' ? 32 : 38 };
    const areaWidth = width - margin.left - margin.right;
    const areaHeight = height - margin.top - margin.bottom;
    const bottom = margin.top + areaHeight;
    areaTop = margin.top;
    areaBottom = bottom;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('height', String(height));

    const domain =
      mode === 'rank'
        ? rankScale(values)
        : // Het gemiddelde deelt zijn as met de dagscores, dus tellen die mee
          // voor het domein: anders vallen de losse punten buiten beeld.
          averageScale([
            ...values,
            ...rows.map((pt) => pt.day_score).filter((v): v is number => v !== null),
          ]);
    const { from, to, ticks, label } = domain;

    // Plaats 1 hoort bovenaan, een hoger gemiddelde ook: de ene as staat dus op
    // zijn kop en de andere niet.
    const y = (value: number) =>
      mode === 'rank'
        ? margin.top + ((value - from) / (to - from)) * areaHeight
        : margin.top + ((to - value) / (to - from)) * areaHeight;
    const x = (index: number) =>
      margin.left + (rows.length === 1 ? areaWidth / 2 : (index / (rows.length - 1)) * areaWidth);
    points = rows.map((pt, index) => ({ x: x(index), y: y(values[index]) }));

    const best = mode === 'rank' ? Math.min(...values) : Math.max(...values);
    // De laatste keer dat hij zijn beste stand haalde: dat is de speeldag die telt.
    const bestIndex = values.lastIndexOf(best);
    const latest = rows[rows.length - 1];

    const grid = layer('grid');
    const axis = layer('axis');
    const daysLayer = layer('days');
    const area = layer('area');
    const labels = layer('labels');
    for (const group of [grid, axis, daysLayer, area, labels]) group.replaceChildren();

    // Hairlines, solide en één stap van de grond: het raster mag nooit meelezen.
    for (const value of ticks) {
      grid.append(
        shape('line', {
          x1: margin.left,
          x2: margin.left + areaWidth,
          y1: y(value),
          y2: y(value),
          stroke: 'currentColor',
          'stroke-width': 1,
        }),
      );
      const tick = shape('text', {
        x: margin.left - 8,
        y: y(value) + 4,
        'text-anchor': 'end',
        fill: 'currentColor',
      });
      tick.textContent = label(value);
      axis.append(tick);
    }

    const visible = labelIndices(rows.length, areaWidth);
    for (const [index, pt] of rows.entries()) {
      if (!visible.has(index)) continue;
      const tick = shape('text', {
        x: x(index),
        y: bottom + 18,
        'text-anchor': 'middle',
        fill: 'currentColor',
      });
      tick.textContent = String(pt.number);
      axis.append(tick);
    }

    const heading = shape('text', { x: 0, y: 10, fill: 'currentColor', class: 'type-label' });
    heading.textContent = mode === 'rank' ? 'Plaats' : 'Gemiddelde';
    const footer = shape('text', {
      x: margin.left + areaWidth / 2,
      y: bottom + 38,
      'text-anchor': 'middle',
      fill: 'currentColor',
      class: 'type-label',
    });
    footer.textContent = 'Speeldag';
    axis.append(heading, footer);

    // De dagscores: losse punten, geen tweede lijn. Ze zijn geen verloop maar
    // losse avonden, en de lijn ertussen is precies wat de rode lijn al is.
    if (mode === 'average') {
      for (const [index, pt] of rows.entries()) {
        if (pt.day_score === null) continue;
        daysLayer.append(
          shape('circle', { cx: x(index), cy: y(pt.day_score), r: 3, fill: 'currentColor' }),
        );
      }
    }

    // De lijn: 2px, ronde verbindingen — dezelfde vluchtdraad, hier met echte data.
    const line = shape('path', {
      d: points.map((pt, index) => `${index === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' '),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    area.append(line);

    // Meetpuntbollen met een ring in de grondkleur, zodat ze los blijven van de lijn.
    for (const [index, pt] of points.entries()) {
      area.append(
        shape('circle', {
          cx: pt.x,
          cy: pt.y,
          r: index === points.length - 1 ? 5 : 4,
          fill: 'currentColor',
          stroke: 'var(--color-feather-50)',
          'stroke-width': 2,
        }),
      );
    }

    // Selectief labelen: het eindpunt en de beste stand. Nooit een cijfer per
    // punt — de as, de tooltip en de tabel dragen de rest.
    const show = (value: number) => (mode === 'rank' ? String(value) : decimal(value));
    const endY = Math.min(points.at(-1)!.y, bottom - 13);
    const end = shape('text', {
      x: margin.left + areaWidth + 12,
      y: endY + 4,
      fill: 'currentColor',
      class: 'type-numeral text-sm',
    });
    end.textContent = show(mode === 'rank' ? latest.rank! : latest.average);
    const endCaption = shape('text', {
      x: margin.left + areaWidth + 12,
      y: endY + 17,
      fill: 'currentColor',
      class: 'type-label opacity-60',
    });
    endCaption.textContent = 'nu';
    labels.append(end, endCaption);

    // Alleen als het beste punt niet tegen het eindpunt aan ligt — anders overlappen de labels.
    if (bestIndex < rows.length - 2) {
      const pt = points[bestIndex];
      // Aan de randen zou een gecentreerd label buiten het vlak steken — over de
      // as-waarden links, of over de rand rechts. Anker het dan aan het punt zelf.
      const anchor = pt.x < margin.left + 20 ? 'start' : pt.x > margin.left + areaWidth - 20 ? 'end' : 'middle';
      const bestLabel = shape('text', {
        x: pt.x,
        y: pt.y - 14,
        'text-anchor': anchor,
        fill: 'currentColor',
        class: 'type-numeral text-sm',
      });
      bestLabel.textContent = show(best);
      const caption = shape('text', {
        x: pt.x,
        y: pt.y - 26,
        'text-anchor': anchor,
        fill: 'currentColor',
        class: 'type-label opacity-60',
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
      for (const [index, dot] of [...area.querySelectorAll('circle')].entries()) {
        dot.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], {
          duration: 500 + (index / points.length) * 600,
          easing: 'linear',
        });
      }
    }
    drawn = true;

    // Het raakvlak is ruimer dan de lijn: mikken op een speeldag, niet op 2px inkt.
    layer('hit').replaceChildren(
      shape('rect', {
        x: margin.left - 12,
        y: margin.top - 12,
        width: areaWidth + 24,
        height: areaHeight + 24,
        fill: 'transparent',
      }),
    );
    if (active >= 0) point(active);
    else layer('cross').replaceChildren();
  }

  /** Alleen hertekenen als de breedte echt veranderde: anders sneuvelt de lijnanimatie. */
  function onResize() {
    const width = Math.max(280, figure.clientWidth);
    if (width === lastWidth) return;
    lastWidth = width;
    draw();
  }

  /** Wat die speeldag opleverde, in woorden — ook voor wie de grafiek niet ziet. */
  function caption(pt: ProgressionPoint): string {
    if (mode === 'rank') {
      return pt.day_score === null
        ? `Speeldag ${pt.number} · uitgeloot`
        : `Speeldag ${pt.number} · gemiddelde ${decimal(pt.average)}`;
    }
    return pt.day_score === null
      ? `Speeldag ${pt.number} · uitgeloot, telt niet mee`
      : `Speeldag ${pt.number} · die avond ${decimal(pt.day_score)}`;
  }

  /** Het kruisdraad zoekt de x: de lezer mikt op een speeldag, nooit op een lijn van 2px. */
  function point(index: number) {
    active = Math.min(Math.max(index, 0), rows.length - 1);
    const pt = points[active];
    if (!pt) return;
    layer('cross').replaceChildren(
      shape('line', { x1: pt.x, x2: pt.x, y1: areaTop, y2: areaBottom, stroke: 'currentColor', 'stroke-width': 1 }),
      shape('circle', { cx: pt.x, cy: pt.y, r: 8, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
    );

    const row = rows[active];
    tooltipValue.textContent =
      mode === 'rank' ? `Plaats ${row.rank}` : `Gemiddelde ${decimal(row.average)}`;
    tooltipCaption.textContent = caption(row);
    tooltip.hidden = false;
    // Onder 280px container-breedte schaalt de viewBox mee; reken dan terug naar CSS-pixels.
    const scaleFactor = svg.clientWidth / lastWidth || 1;
    // Bij de eerste en laatste speeldag zou een gecentreerde tooltip half buiten
    // het scherm hangen; klem hem binnen de figuur (hij is -translate-x-1/2).
    const half = tooltip.offsetWidth / 2;
    const bound = figure.clientWidth;
    tooltip.style.left = `${Math.min(Math.max(pt.x * scaleFactor, half), Math.max(half, bound - half))}px`;
    tooltip.style.top = `${pt.y * scaleFactor}px`;
    message.textContent = `${tooltipValue.textContent}. ${caption(row)}.`;
  }

  function hide() {
    active = -1;
    layer('cross').replaceChildren();
    tooltip.hidden = true;
    message.textContent = '';
  }

  function nearest(mouseX: number) {
    let closest = 0;
    for (let index = 1; index < points.length; index++) {
      if (Math.abs(points[index].x - mouseX) < Math.abs(points[closest].x - mouseX)) closest = index;
    }
    return closest;
  }

  svg.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    point(nearest(((event.clientX - box.left) / box.width) * lastWidth));
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => point(active < 0 ? rows.length - 1 : active));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (event) => {
    const jumps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -rows.length,
      End: rows.length,
    };
    const step = jumps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    point((active < 0 ? rows.length - 1 : active) + step);
  });

  prepare();
  lastWidth = Math.max(280, figure.clientWidth);
  draw();
  new ResizeObserver(onResize).observe(figure);

  return {
    setMode(next: ProgressionMode) {
      if (next === mode) return;
      mode = next;
      // De aanwijzer hoort niet op een speeldag te blijven staan die in de
      // andere reeks een ander punt is.
      hide();
      // De lijn opnieuw laten tekenen: het is een andere reeks, geen resize.
      drawn = false;
      prepare();
      draw();
    },
  };
}
