// llms.txt: een korte, gestructureerde wegwijzer voor taalmodellen die de site
// lezen (https://llmstxt.org). Gegenereerd in plaats van een vast bestand in
// public/, om dezelfde reden als het manifest: de links moeten absoluut zijn én
// de base path volgen. Die staat nu op /Website (GitHub Pages) en wordt bij de
// domeinswitch naar bclandegem.be '/' — dan klopt dit bestand vanzelf nog.
//
// Bewust kort: alleen de pagina's die een vraag over de club beantwoorden, met
// per link genoeg context om te weten wanneer je ze nodig hebt. De detailpagina's
// die op een queryparameter draaien (/intraclub/speler/, /intraclub/speeldag/)
// staan er niet in — zonder parameter tonen ze niets.
import type { APIRoute } from 'astro';
import { url } from '../lib/url';
import { PUSH_ENABLED } from '../data/push';

type Link = [path: string, name: string, note: string];

const SECTIONS: { heading: string; links: Link[] }[] = [
  {
    heading: 'Meespelen',
    links: [
      ['/club/word-lid/', 'Word lid', 'Alle speelmomenten, wat je meebrengt, het lidgeld en hoe je inschrijft. Nieuwe spelers mogen drie keer gratis meespelen.'],
      ['/jeugd/', 'Jeugd', 'Jeugdwerking vanaf 8 jaar: vrij spelen op woensdagavond en training op zaterdag in twee groepen (9u30 en 11u). Geen selectie.'],
      ['/recreatief/', 'Recreatief', 'Badminton voor volwassenen: vrij spel op maandag, woensdag en zondag, intraclub en een lessenreeks van vijf avonden.'],
      ['/kalender/', 'Kalender', 'Trainingen, vrij spel, competitiematchen, intraclub en clubevents.'],
      ['/club/twizzit/', 'Tips voor Twizzit', 'Aanmelden bij Twizzit, je planning en aanwezigheid opvolgen, meldingen instellen en wisselen tussen gezinsleden.'],
      ['/club/contact/', 'Contact', 'Waar we spelen en bij wie je met welke vraag terechtkan. Contact loopt via het formulier; er staat bewust geen e-mailadres op de site.'],
    ],
  },
  {
    heading: 'Spelen en standen',
    links: [
      ['/competitie/', 'Competitie', 'De competitieploegen, met klassement en wedstrijdkalender per ploeg.'],
      ['/intraclub/', 'Intraclub', 'Stand en uitslagen van de lopende intraclubcompetitie.'],
      ['/intraclub/zo-werkt-het/', 'Zo werkt intraclub', 'De loting, de bonuspunten en het klassement, uitgelegd aan de hand van een echte speeldag.'],
      ['/intraclub/erelijst/', 'Erelijst', 'Wie de intraclub won, seizoen per seizoen.'],
    ],
  },
  {
    heading: 'Club',
    links: [
      ['/club/over-de-club/', 'Over de club', 'De geschiedenis sinds 1987 en de kampioenstitels van de ploegen.'],
      ['/club/gedragscode/', 'Gedragscode', 'Wat we van elkaar verwachten, op en naast het veld. Vervangt het oude intern reglement.'],
      ['/club/aanspreekpunt-integriteit/', 'Aanspreekpunt Integriteit', 'Waar je terechtkan met vragen, vermoedens of klachten over grensoverschrijdend gedrag.'],
      ['/club/melden/', 'Iets melden', 'Meldformulier grensoverschrijdend gedrag; komt alleen bij het Aanspreekpunt Integriteit terecht.'],
      ['/club/privacy/', 'Privacy', 'Hoe de club met persoonsgegevens omgaat (GDPR).'],
      ...(PUSH_ENABLED
        ? [['/club/pushberichten/', 'Pushberichten', 'Berichten op je toestel over nieuwe intraclubstanden, en af en toe een clubbericht, aan- en afzetten per onderwerp.'] as Link]
        : []),
    ],
  },
  {
    // 'Optional' is geen slordige vertaling maar een sleutelwoord uit de spec:
    // een lezer die kort moet blijven, mag precies deze sectie overslaan.
    heading: 'Optional',
    links: [
      ['/media/', "Foto's", 'Fotoalbums van jeugdcups, intraclub, clubweekends en ander clubleven.'],
      ['/archief/', 'Archief', 'Het archief van de oude clubsite: honderden artikels met wedstrijdverslagen, intraclub, jeugdweekends en clubnieuws, per jaar en per rubriek.'],
    ],
  },
];

export const GET: APIRoute = ({ site }) => {
  const absolute = (path: string) => (site ? new URL(url(path), site).href : url(path));

  const body = [
    '# BC Landegem',
    '',
    '> Badmintonclub Landegem (BC Landegem), opgericht in 1987 en spelend in Sporthal Oostbroek in Nevele (Deinze, Oost-Vlaanderen): recreatief en competitief badminton voor jong en oud, met jeugdwerking, recreatieve speelavonden, een eigen intraclubcompetitie en competitieploegen.',
    '',
    'De site is volledig Nederlandstalig (nl-BE). Er zijn vijf vaste speelmomenten per week (maandag, woensdag, zaterdag en zondag); proefbeurten zijn altijd welkom en nieuwe spelers mogen drie keer gratis meespelen. Inschrijven gebeurt via een extern Twizzit-formulier.',
    '',
    ...SECTIONS.flatMap(({ heading, links }) => [
      `## ${heading}`,
      '',
      ...links.map(([path, name, note]) => `- [${name}](${absolute(path)}): ${note}`),
      '',
    ]),
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
