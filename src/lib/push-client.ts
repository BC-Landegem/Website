// Client-side kant van de pushberichten: het abonnement in de browser en het
// gesprek met de server erover. Gebruikt door src/components/PushSettings.astro.
// Het ontvangen zelf zit in de service worker (src/sw/service-worker.js).
//
// De server is de bron van de waarheid voor de onderwerpen, niet localStorage:
// een PUT zónder topics geeft de bewaarde onderwerpen terug (of [] voor een
// endpoint dat hij nog niet kende). Zo klopt de pagina ook op een tweede
// toestel dat nooit lokaal iets bewaarde, en na een schoongemaakte browser.
import { PUSH_ENDPOINT, VAPID_PUBLIC_KEY, type PushTopic } from '../data/push';

export type PushSupport =
  /** Alles aan boord. */
  | 'ok'
  /** iOS zonder installatie: Safari geeft push alleen aan een app op het beginscherm. */
  | 'ios-install'
  /** Browser kent geen push, of geen service worker (bv. privénavigatie in Firefox). */
  | 'unsupported'
  /** Er is geen VAPID-sleutel meegebouwd, dus staat push voor deze site uit. */
  | 'disabled';

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return 'disabled';
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasPush) return 'ok';
  // iPadOS meldt zich als Mac; het aantal aanraakpunten verraadt hem.
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone ? 'ios-install' : 'unsupported';
}

export function permission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied';
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // .ready wacht tot er een actieve worker is. Die is er op deze site altijd
  // (Layout registreert hem bij elke paginalading), maar niet meteen bij het
  // allereerste bezoek — daarom wachten en niet getRegistration(). Wel met een
  // grens: in de dev-server wordt geen worker geregistreerd, en een registratie
  // die om een andere reden blijft hangen mag de pagina niet stil laten wachten.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('De app is nog niet klaar op dit toestel. Herlaad de pagina en probeer het opnieuw.')),
      8000,
    );
    navigator.serviceWorker.ready.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  return (await registration()).pushManager.getSubscription();
}

/**
 * Wat de server van dit toestel weet. Bestaat er lokaal geen abonnement, dan is
 * er niets te vragen en is het antwoord null: de pagina toont dan de uit-stand.
 */
export async function currentTopics(): Promise<PushTopic[] | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  return sync(subscription);
}

/**
 * Zet het abonnement op precies deze onderwerpen. Geen onderwerpen = helemaal
 * uit: abonnement weg bij de server én in de browser. De toestemming van de
 * browser blijft staan, dus opnieuw aanzetten is daarna één tik zonder prompt.
 *
 * Gooit een Error met een korte Nederlandse boodschap als het niet lukt; de
 * pagina toont die letterlijk.
 */
export async function setTopics(topics: PushTopic[]): Promise<PushTopic[]> {
  if (topics.length === 0) {
    await unsubscribe();
    return [];
  }
  const subscription = await subscribe();
  return sync(subscription, topics);
}

async function subscribe(): Promise<PushSubscription> {
  const manager = (await registration()).pushManager;
  const key = vapidKey();
  const existing = await manager.getSubscription();
  if (existing) {
    // Een abonnement op een andere (oudere) sleutel kan niet bijgewerkt
    // worden; subscribe() zou een InvalidStateError geven. Dan eerst weg.
    if (sameKey(existing.options.applicationServerKey, key)) return existing;
    await existing.unsubscribe().catch(() => {});
  }

  // De prompt komt hier, binnen de klik van de gebruiker. requestPermission
  // eerst en apart: dan weten we bij 'denied' wat er gebeurde, in plaats van
  // een NotAllowedError te moeten ontrafelen.
  const granted = await Notification.requestPermission();
  if (granted !== 'granted') {
    throw new Error(
      granted === 'denied'
        ? 'Je browser blokkeert berichten van deze site. Dat zet je terug aan in de instellingen van je browser, bij de rechten van deze site.'
        : 'Je hebt de vraag om berichten te tonen gesloten zonder te kiezen. Probeer het gerust opnieuw.',
    );
  }

  try {
    return await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch {
    throw new Error(
      'Je browser kon geen abonnement aanmaken. Meestal helpt het om de pagina te herladen en het opnieuw te proberen.',
    );
  }
}

async function unsubscribe(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  // Eerst de server, dan de browser. Faalt de server, dan blijft het
  // abonnement lokaal bestaan en kan de gebruiker het opnieuw proberen. Faalt
  // de browser, dan houdt de server een dood endpoint over en ruimt hij dat op
  // bij het eerste bericht dat er 404 of 410 op krijgt.
  await request('DELETE', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/** PUT naar de server: met topics om te zetten, zonder om te lezen. */
async function sync(subscription: PushSubscription, topics?: PushTopic[]): Promise<PushTopic[]> {
  const body: Record<string, unknown> = { ...subscription.toJSON() };
  if (topics) body.topics = topics;
  const response = await request('PUT', body);
  const data = (await response.json().catch(() => ({}))) as { topics?: unknown };
  return Array.isArray(data.topics) ? (data.topics as PushTopic[]) : topics ?? [];
}

async function request(method: 'PUT' | 'DELETE', body: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(PUSH_ENDPOINT, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('De server is even niet bereikbaar. Probeer het straks opnieuw.');
  }
  if (!response.ok) {
    throw new Error('De server kon je keuze niet bewaren. Probeer het straks opnieuw.');
  }
  return response;
}

/**
 * base64url → bytes, wat pushManager.subscribe als applicationServerKey wil.
 * Een sleutel die niet decodeert of niet de 65 bytes van een P-256-punt telt,
 * is een configuratiefout bij het bouwen — dat zeggen we dan ook zo, in plaats
 * van de atob-fout van de browser te tonen.
 */
function vapidKey(): Uint8Array<ArrayBuffer> {
  try {
    const padded = VAPID_PUBLIC_KEY + '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    if (raw.length !== 65) throw new Error('lengte');
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    throw new Error('De sleutel van de site klopt niet; laat het ons weten via het contactformulier.');
  }
}

function sameKey(current: ArrayBuffer | null, wanted: Uint8Array<ArrayBuffer>): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === wanted.length && bytes.every((byte, i) => byte === wanted[i]);
}
