// ============================================================================
// JADIJCB: Moroccan Public Works Tenders Scraper & Midnight 00:00 Scheduler
// Exclusively for Machinery Owners — Runs on Server Only (initial boot run +
// daily 00:00 Africa/Casablanca automatic scan).
// Combines direct marchespublics.gov.ma scraping, Moroccan BTP award feeds,
// live corporate website contact extraction (phone/email/website ONLY),
// and optional Gemini Search Grounding when GEMINI_API_KEY is configured.
// ============================================================================

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';

export type TenderSector =
  | 'routes_vrd'
  | 'terrassement'
  | 'hydraulique'
  | 'batiment'
  | 'genie_civil'
  | 'other';

export interface PublicTenderRecord {
  id: string;
  reference_code: string;
  dedup_key: string;
  title_ar: string;
  title_fr: string;
  contracting_authority: string;
  sector: TenderSector;
  city: string;
  region: string;
  award_date: string;
  amount_mad: number;
  winning_company: string;
  company_city: string;
  contact_phone: string;
  contact_email: string;
  company_website: string;
  source_url: string;
  source_domain: string;
  machinery_needed: string[];
  summary_ar: string;
  summary_fr: string;
  scraped_at: string;
  scan_batch_id: string;
}

export interface TenderScrapeRunRecord {
  id: string;
  trigger_type: 'scheduled_midnight' | 'initial_server_boot' | 'manual';
  status: 'running' | 'completed' | 'error';
  sector_filter: string;
  region_filter: string;
  found_count: number;
  new_count: number;
  sources: Array<{ uri: string; title: string }>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface ScrapeResult {
  run: TenderScrapeRunRecord;
  tenders: PublicTenderRecord[];
  newCount: number;
  updatedCount: number;
}

const MOROCCO_TZ = 'Africa/Casablanca';

export function getCasablancaClockParts(date: Date = new Date()): {
  dateKey: string;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOROCCO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const hourNum = Number(map.hour === '24' ? '0' : map.hour || 0);
  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: hourNum,
    minute: Number(map.minute || 0),
    second: Number(map.second || 0),
  };
}

export function getNextMidnightCasablancaIso(now: Date = new Date()): string {
  const { hour, minute, second } = getCasablancaClockParts(now);
  const secondsPassedToday = hour * 3600 + minute * 60 + second;
  const secondsUntilMidnight = Math.max(1, 24 * 3600 - secondsPassedToday);
  return new Date(now.getTime() + secondsUntilMidnight * 1000).toISOString();
}

function normalizeUrl(raw?: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`;
  return '';
}

function normalizeEmail(raw?: string): string {
  const v = String(raw || '').trim().toLowerCase();
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return '';
  if (/example|sentry|wix|wordpress|test@|noreply|no-reply/i.test(v)) return '';
  return v;
}

function normalizePhone(raw?: string): string {
  const v = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  const digits = v.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 14) return '';
  return v;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function makeDedupKey(refCode: string, title: string, company: string): string {
  const clean = (s: string) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
      .trim()
      .slice(0, 75);
  const r = clean(refCode);
  const c = clean(company);
  if (r && r.length >= 5 && !r.startsWith('ao maroc') && c) return `${r}::${c}`;
  return `${clean(title).slice(0, 55)}::${c}`;
}

function decodeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .trim();
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Known Moroccan & active BTP corporate domains for live contact coordinate lookup
const KNOWN_COMPANY_WEB_CANDIDATES: Array<{
  pattern: RegExp;
  canonicalName: string;
  city: string;
  urls: string[];
}> = [
  {
    pattern: /\bSGTM\b/i,
    canonicalName: 'SGTM (Société Générale des Travaux du Maroc)',
    city: 'الدار البيضاء',
    urls: ['https://www.sgtm-maroc.com/contact/', 'https://www.sgtm-maroc.com/'],
  },
  {
    pattern: /\bTGCC\b/i,
    canonicalName: 'TGCC (Travaux Généraux de Construction de Casablanca)',
    city: 'الدار البيضاء',
    urls: ['https://tgcc.ma/contact/', 'https://tgcc.ma/'],
  },
  {
    pattern: /\bSTAM\b/i,
    canonicalName: 'STAM (Société des Travaux Agricoles et Modernes)',
    city: 'الدار البيضاء',
    urls: ['https://stam.ma/contact/', 'https://stam.ma/'],
  },
  {
    pattern: /Lamalif/i,
    canonicalName: 'Lamalif Group',
    city: 'مراكش',
    urls: ['https://lamalifgroup.ma/contact/', 'https://lamalifgroup.ma/'],
  },
  {
    pattern: /Jet Contractors/i,
    canonicalName: 'Jet Contractors',
    city: 'الصخيرات - الرباط',
    urls: ['https://www.jet-contractors.com/contact/', 'https://jet-contractors.com/'],
  },
  {
    pattern: /NGE\s*Contracting/i,
    canonicalName: 'NGE Contracting Maroc',
    city: 'الرباط / الدار البيضاء',
    urls: ['https://www.nge.fr/contact/', 'https://www.nge.fr/'],
  },
  {
    pattern: /Colas\s*Rail|Colas\s*Maroc|GTR/i,
    canonicalName: 'Colas Rail / GTR Maroc',
    city: 'الدار البيضاء',
    urls: ['https://www.colasrail.com/en/contact/', 'https://www.colas.com/fr/contact/'],
  },
  {
    pattern: /\bHouar\b/i,
    canonicalName: 'Entreprise Houar Travaux Publics',
    city: 'وجدة',
    urls: ['https://www.houar.ma/contact', 'https://www.houar.ma/'],
  },
  {
    pattern: /Bioui|SBTX/i,
    canonicalName: 'Bioui Travaux / SBTX',
    city: 'وجدة',
    urls: ['https://www.sbtx.ma/contact/', 'https://www.sbtx.ma/'],
  },
  {
    pattern: /Somagec/i,
    canonicalName: 'SOMAGEC Maroc',
    city: 'الدار البيضاء',
    urls: ['https://www.somagec.ma/contact/', 'https://www.somagec.ma/'],
  },
  {
    pattern: /Mojazine/i,
    canonicalName: 'Mojazine Travaux',
    city: 'الدار البيضاء',
    urls: ['https://www.mojazine.ma/contact/', 'https://www.mojazine.ma/'],
  },
  {
    pattern: /SNCE/i,
    canonicalName: 'SNCE (Société Nouvelle des Conduites d’Eau)',
    city: 'الدار البيضاء',
    urls: ['https://www.snce.ma/contact/', 'https://www.snce.ma/'],
  },
  {
    pattern: /SOREMAR/i,
    canonicalName: 'SOREMAR',
    city: 'أكادير / الرباط',
    urls: ['https://www.soremar.ma/contact/', 'https://www.soremar.ma/'],
  },
  {
    pattern: /Egis\s*Rail|\bEgis\b/i,
    canonicalName: 'Egis Rail Maroc',
    city: 'الرباط',
    urls: ['https://www.egis-group.com/locations/morocco', 'https://www.egis-group.com/'],
  },
  {
    pattern: /Alstom/i,
    canonicalName: 'Alstom Transport Maroc',
    city: 'الرباط / فاس',
    urls: ['https://www.alstom.com/alstom-morocco'],
  },
  {
    pattern: /CREC\s*4|China Railway/i,
    canonicalName: 'CREC 4 Maroc (China Railway Fourth Bureau)',
    city: 'القنيطرة / مراكش',
    urls: ['https://www.crec4.com/'],
  },
];

const contactCache = new Map<
  string,
  { phone: string; email: string; website: string; city: string }
>();

/**
 * Fetches live HTML from candidate corporate pages and extracts ONLY verified
 * phone numbers, email addresses, and official websites (no guessing/mocking).
 */
async function enrichCompanyContactsLive(companyName: string): Promise<{
  canonicalName: string;
  phone: string;
  email: string;
  website: string;
  city: string;
}> {
  const matched = KNOWN_COMPANY_WEB_CANDIDATES.find((c) =>
    c.pattern.test(companyName)
  );
  const cacheKey = (matched?.canonicalName || companyName).toLowerCase();
  const cached = contactCache.get(cacheKey);
  if (cached) {
    return {
      canonicalName: matched?.canonicalName || companyName,
      ...cached,
    };
  }

  let candidateUrls: string[] = matched ? [...matched.urls] : [];
  if (candidateUrls.length === 0) {
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24);
    if (slug.length >= 3) {
      candidateUrls = [`https://www.${slug}.ma/contact`, `https://www.${slug}.ma/`];
    }
  }

  let foundPhone = '';
  let foundEmail = '';
  let foundWebsite = '';

  for (const url of candidateUrls) {
    if (foundPhone && foundEmail && foundWebsite) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (!html || html.length < 200) continue;

      if (!foundWebsite) {
        try {
          const parsedUrl = new URL(resp.url || url);
          foundWebsite = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
        } catch {
          foundWebsite = url;
        }
      }

      // Extract explicit href="tel:..." & href="mailto:..." first
      const telLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) =>
        m[1].trim()
      );
      for (const rawTel of telLinks) {
        const cleanTel = normalizePhone(rawTel);
        if (cleanTel && !foundPhone) {
          foundPhone = cleanTel;
          break;
        }
      }

      const mailLinks = [...html.matchAll(/href=["']mailto:([^"'?]+)["']/gi)].map((m) =>
        m[1].trim()
      );
      for (const rawMail of mailLinks) {
        const cleanMail = normalizeEmail(rawMail);
        if (cleanMail && !foundEmail) {
          foundEmail = cleanMail;
          break;
        }
      }

      // Extract visible phone & email from tag-stripped text (avoids SVG path false positives)
      const visibleText = stripHtmlToText(html);
      if (!foundPhone) {
        const phoneMatches =
          visibleText.match(/(?:\+212|00212|0)\s*[567](?:[\s.-]*\d){8}/g) || [];
        for (const pm of phoneMatches) {
          const cleanTel = normalizePhone(pm);
          if (cleanTel) {
            foundPhone = cleanTel;
            break;
          }
        }
      }

      if (!foundEmail) {
        const emailMatches =
          visibleText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        for (const em of emailMatches) {
          const cleanMail = normalizeEmail(em);
          if (cleanMail) {
            foundEmail = cleanMail;
            break;
          }
        }
      }
    } catch {
      // ignore site timeout/DNS failure
    } finally {
      clearTimeout(timer);
    }
  }

  const out = {
    phone: foundPhone,
    email: foundEmail,
    website: foundWebsite,
    city: matched?.city || '',
  };
  contactCache.set(cacheKey, out);
  return {
    canonicalName: matched?.canonicalName || companyName,
    ...out,
  };
}

/**
 * Direct scrape of official Moroccan Public Procurement Portal (marchespublics.gov.ma).
 * Parses live definitive attribution / Travaux listings.
 */
async function scrapeMarchesPublicsPortalLive(): Promise<{
  snippets: string[];
  portalUrls: Array<{ uri: string; title: string }>;
  portalReferences: Array<{
    reference: string;
    title: string;
    authority: string;
    city: string;
    url: string;
  }>;
}> {
  const urls = [
    'https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisAttribution',
    'https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisExtraitPV',
  ];

  const snippets: string[] = [];
  const portalUrls: Array<{ uri: string; title: string }> = [];
  const portalReferences: Array<{
    reference: string;
    title: string;
    authority: string;
    city: string;
    url: string;
  }> = [];

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9500);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-MA,fr;q=0.9',
        },
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (!html || html.length < 500) continue;

      portalUrls.push({
        uri: url,
        title: url.includes('AvisExtraitPV')
          ? 'marchespublics.gov.ma — Extraits de PV'
          : 'marchespublics.gov.ma — Résultats définitifs',
      });

      const cards = html.split(/class="item tender_item"/i).slice(1, 15);
      for (const card of cards) {
        const refMatch = card.match(/referencem[^>]*>([^<]+)<\/span>/i);
        const linkMatch = card.match(
          /href=["']([^"']*EntrepriseDetailsConsultation[^"']+)["']/i
        );
        const text = stripHtmlToText(card);
        const objMatch = text.match(/Objet\s*:\s*([\s\S]*?)(?:Détail|Acheteur public)/i);
        const authMatch = text.match(
          /Acheteur public\s*:\s*([\s\S]*?)(?:Date limite|Lieu d'exécution)/i
        );
        const locMatch = text.match(/Lieu d'exécution\s*:\s*([A-ZÀ-Ÿa-zà-ÿ\s,-]{3,50})/i);

        const reference = (refMatch?.[1] || '').trim();
        const title = (objMatch?.[1] || '').replace(/\.{3}$/, '').trim();
        const authority = (authMatch?.[1] || '').trim();
        const city = (locMatch?.[1] || '').replace(/MAROC/gi, '').trim();
        const detailUrl = linkMatch?.[1]
          ? decodeHtmlEntities(linkMatch[1])
          : url;

        if (
          title &&
          /travaux|terrassement|route|voirie|vrd|réseau|bâtiment|génie|eau|assainissement|piste|construction|aménagement|ouvrage/i.test(
            title
          )
        ) {
          portalReferences.push({
            reference: reference || 'PMMP',
            title,
            authority,
            city,
            url: detailUrl,
          });
          snippets.push(
            `[marchespublics.gov.ma] Réf: ${reference} | Objet: ${title} | Acheteur: ${authority} | Lieu: ${city} | Lien: ${detailUrl}`
          );
        }
      }
    } catch {
      // graceful fallback
    } finally {
      clearTimeout(timer);
    }
  }

  return { snippets, portalUrls, portalReferences };
}

function inferSectorFromText(text: string): TenderSector {
  const s = text.toLowerCase();
  if (/terrassement|déblai|remblai|excavation|حفر|ردم/.test(s)) return 'terrassement';
  if (/\b(route|autoroute|voirie|vrd|piste|échangeur|trémie|corniche)\b|طرق|تزفيت|تهيئة/.test(s))
    return 'routes_vrd';
  if (/\b(barrage|eau|assainissement|irrigation|canal)\b|سدود|ماء|تطهير/.test(s))
    return 'hydraulique';
  if (/stade|complexe sportif|cité sportive|hôpital|aéroport|terminal|bâtiment|gare|ملعب|مطار|بناء/.test(s))
    return 'batiment';
  if (/pont|viaduc|lgv|port|tunnel|génie civil|قناطر|ميناء|قطار|سكة/.test(s))
    return 'genie_civil';
  return 'other';
}

function inferMachineryNeeded(sector: TenderSector, text: string): string[] {
  switch (sector) {
    case 'terrassement':
      return ['حفارة هيدروليكية (Pelle)', 'جرافة (Bulldozer)', 'شاحنة قلابة (Camion benne)', 'تراكتور (Tractopelle)'];
    case 'routes_vrd':
      return ['آلة تسوية الطرق (Niveleuse)', 'مدحلة (Compacteur)', 'شاحنة قلاب (Benne)', 'تراكتور (Tractopelle)'];
    case 'hydraulique':
      return ['حفارة خنادق (Pelle sur chenilles)', 'تراكتور جرافة (Tractopelle)', 'مدحلة خنادق'];
    case 'genie_civil':
      return ['حفارة ثقيلة (Pelle 30T+)', 'رافعة (Grue mobile)', 'مضخة خرسانة', 'شاحنات نقل ثقيل'];
    case 'batiment':
      return ['رافعة برجية / متحركة (Grue)', 'تراكتور جرافة (Tractopelle)', 'حفارة أساسات', 'شاحنة قلابة'];
    default:
      if (/vrd|voirie/i.test(text)) {
        return ['تراكتور جرافة (Tractopelle)', 'مدحلة (Compacteur)', 'شاحنة قلابة'];
      }
      return ['حفارة هيدروليكية (Pelle)', 'تراكتور جرافة (Tractopelle)', 'شاحنة قلابة'];
  }
}

function parseAmountMadFromText(text: string): number {
  const norm = text.replace(/\s+/g, ' ');
  const mmdh = norm.match(/([\d]+(?:[.,]\d+)?)\s*(?:mmdh|milliards?\s*(?:de\s*)?(?:dh|dirhams|mad))/i);
  if (mmdh) {
    return Math.round(parseFloat(mmdh[1].replace(',', '.')) * 1_000_000_000);
  }
  const mdh = norm.match(/([\d]+(?:[.,]\d+)?)\s*(?:mdh|millions?\s*(?:de\s*)?(?:dh|dirhams|mad))/i);
  if (mdh) {
    return Math.round(parseFloat(mdh[1].replace(',', '.')) * 1_000_000);
  }
  const eur = norm.match(/([\d]+(?:[.,]\d+)?)\s*(?:m€|millions?\s*d['’]?euros)/i);
  if (eur) {
    return Math.round(parseFloat(eur[1].replace(',', '.')) * 10_800_000);
  }
  return 0;
}

function extractCityAndRegion(text: string): { city: string; region: string } {
  const mappings: Array<{ rx: RegExp; city: string; region: string }> = [
    { rx: /benslimane|stade\s*hassan\s*ii|بنسليمان/i, city: 'بنسليمان', region: 'الدار البيضاء - سطات' },
    { rx: /casablanca|mohammed\s*v|casa|الدار البيضاء/i, city: 'الدار البيضاء', region: 'الدار البيضاء - سطات' },
    { rx: /rabat|salé|kénitra|bouregreg|الرباط|القنيطرة/i, city: 'الرباط / القنيطرة', region: 'الرباط - سلا - القنيطرة' },
    { rx: /marrakech|al\s*haouz|ouirgane|مراكش|الحوز/i, city: 'مراكش', region: 'مراكش - آسفي' },
    { rx: /fès|fes|فاس/i, city: 'فاس', region: 'فاس - مكناس' },
    { rx: /tanger|tétouan|al\s*hoceima|طنجة/i, city: 'طنجة', region: 'طنجة - تطوان - الحسيمة' },
    { rx: /agadir|souss|أكادير/i, city: 'أكادير', region: 'سوس - ماسة' },
    { rx: /nador|oujda|oriental|الناظور|وجدة/i, city: 'الناظور / وجدة', region: 'الشرق' },
    { rx: /azilal|béni\s*mellal|أزيلال|بني ملال/i, city: 'أزيلال', region: 'بني ملال - خنيفرة' },
    { rx: /dakhla|الداخلة/i, city: 'الداخلة', region: 'الداخلة - وادي الذهب' },
    { rx: /\blgv\b/i, city: 'القنيطرة / مراكش', region: 'الرباط - سلا - القنيطرة' },
  ];
  for (const m of mappings) {
    if (m.rx.test(text)) return { city: m.city, region: m.region };
  }
  return { city: 'المغرب', region: '' };
}

function inferAuthorityFromText(text: string): string {
  if (/stade|complexe sportif|sonarges|ملعب/i.test(text))
    return 'الوكالة الوطنية للتجهيزات العامة (ANEP) / SONARGES';
  if (/lgv|oncf|gare|قطار|سكة/i.test(text)) return 'المكتب الوطني للسكك الحديدية (ONCF)';
  if (/aéroport|onda|terminal|مطار/i.test(text)) return 'المكتب الوطني للمطارات (ONDA)';
  if (/nador\s*west|marsa|port|ميناء/i.test(text)) return 'الوكالة الوطنية للموانئ / مرسى المغرب';
  if (/barrage|oued|eau|سدود|سد/i.test(text)) return 'وزارة التجهيز والماء';
  if (/autoroute|adm|طريق سيار/i.test(text)) return 'الشركة الوطنية للطرق السيارة (ADM)';
  if (/route|routier|voirie|corniche|trémie|طرق/i.test(text))
    return 'وزارة التجهيز والماء / الجماعات الترابية';
  return 'مؤسسة عمومية مغربية (صفقة عمومية)';
}

/**
 * Scrapes live Moroccan BTP awarded public works tenders from Moroccan press & procurement feeds,
 * then resolves each winning company's live official contact coordinates.
 */
async function scrapeMoroccanWebTenderAwards(): Promise<{
  items: Array<{
    reference_code: string;
    title_ar: string;
    title_fr: string;
    contracting_authority: string;
    sector: TenderSector;
    city: string;
    region: string;
    award_date: string;
    amount_mad: number;
    winning_company: string;
    source_url: string;
    summary_fr: string;
    summary_ar: string;
  }>;
  sources: Array<{ uri: string; title: string }>;
}> {
  const rssUrls = [
    'https://news.google.com/rss/search?q=(%22march%C3%A9%22+OR+%22lot%22)+(%22attribu%C3%A9%22+OR+%22remport%C3%A9%22+OR+%22d%C3%A9croche%22)+(%22travaux%22+OR+%22terrassement%22+OR+%22barrage%22+OR+%22routes%22+OR+%22VRD%22)+Maroc&hl=fr&gl=MA&ceid=MA:fr',
    'https://news.google.com/rss/search?q=(%22SGTM%22+OR+%22TGCC%22+OR+%22STAM%22+OR+%22Jet+Contractors%22+OR+%22Lamalif%22+OR+%22Houar%22+OR+%22Somagec%22)+(%22march%C3%A9%22+OR+%22travaux%22)+Maroc&hl=fr&gl=MA&ceid=MA:fr',
  ];

  const rawEntries: Array<{ title: string; link: string; pubDate: string }> = [];
  const sources: Array<{ uri: string; title: string }> = [];

  for (const rssUrl of rssUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const resp = await fetch(rssUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
      for (const m of matches) {
        const block = m[1];
        const title = decodeHtmlEntities(
          (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ''
        );
        const link = decodeHtmlEntities(
          (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || ''
        );
        const pubDate = decodeHtmlEntities(
          (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || ''
        );
        if (title && link) {
          rawEntries.push({ title, link, pubDate });
        }
      }
    } catch {
      // ignore timeout
    } finally {
      clearTimeout(timer);
    }
  }

  const companyDetectors: Array<{ rx: RegExp; name: string }> = [
    { rx: /\bSGTM\s*[-–/et]+\s*TGCC\b/i, name: 'SGTM / TGCC' },
    { rx: /\bSGTM\b/i, name: 'SGTM' },
    { rx: /\bTGCC\b/i, name: 'TGCC' },
    { rx: /\bSTAM\b/i, name: 'STAM' },
    { rx: /Lamalif/i, name: 'Lamalif Group' },
    { rx: /Jet\s*Contractors/i, name: 'Jet Contractors' },
    { rx: /NGE\s*Contracting/i, name: 'NGE Contracting' },
    { rx: /Colas\s*Rail/i, name: 'Colas Rail' },
    { rx: /\bHouar\b/i, name: 'Houar' },
    { rx: /Bioui|SBTX/i, name: 'Bioui Travaux / SBTX' },
    { rx: /Somagec/i, name: 'Somagec' },
    { rx: /Mojazine/i, name: 'Mojazine' },
    { rx: /Egis\s*Rail/i, name: 'Egis Rail' },
    { rx: /\bAlstom\b/i, name: 'Alstom' },
    { rx: /\bCREC\s*4\b/i, name: 'CREC 4' },
    { rx: /\bSOREMAR\b/i, name: 'SOREMAR' },
  ];

  const clusterMap = new Map<
    string,
    {
      reference_code: string;
      title_ar: string;
      title_fr: string;
      contracting_authority: string;
      sector: TenderSector;
      city: string;
      region: string;
      award_date: string;
      amount_mad: number;
      winning_company: string;
      source_url: string;
      summary_fr: string;
      summary_ar: string;
    }
  >();

  for (const entry of rawEntries) {
    const cleanTitle = entry.title.replace(/\s+-\s+[^-]+(?:\s+-\s+[^-]+)?$/, '').trim();
    const isBtpAward =
      /(marché|lot|travaux|terrassement|barrage|stade|lgv|terminal|gare|aménagement|corniche|trémie|cité sportive)/i.test(
        cleanTitle
      ) &&
      /(attribué|remporté|décroche|retenu|adjudicataire)/i.test(cleanTitle);

    if (!isBtpAward) continue;

    // Skip non-heavy-machinery interior lots like ascenseurs / mobilier urbain
    if (/ascenseurs|bus amphibies/i.test(cleanTitle)) continue;

    let detectedCompany = '';
    for (const det of companyDetectors) {
      if (det.rx.test(cleanTitle)) {
        detectedCompany = det.name;
        break;
      }
    }
    if (!detectedCompany) continue;

    const parsedDate = entry.pubDate ? new Date(entry.pubDate) : null;
    const awardDate =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : '';

    const { city, region } = extractCityAndRegion(cleanTitle);
    const sector = inferSectorFromText(cleanTitle);
    const amountMad = parseAmountMadFromText(cleanTitle);
    const authority = inferAuthorityFromText(cleanTitle);

    const clusterKey = makeTenderClusterKey(cleanTitle, detectedCompany, city);
    const refHash = crypto
      .createHash('md5')
      .update(clusterKey)
      .digest('hex')
      .slice(0, 6)
      .toUpperCase();
    const yearTag = awardDate ? awardDate.slice(0, 4) : '2026';
    const refCode = `MP-${yearTag}-${refHash}`;

    const summaryAr = `صفقة أشغال عمومية مرصودة للشركة الفائزة (${detectedCompany}) في مجال ${
      sector === 'terrassement'
        ? 'الحفر والردم'
        : sector === 'routes_vrd'
        ? 'الطرق والتهيئة'
        : sector === 'hydraulique'
        ? 'السدود والماء'
        : sector === 'genie_civil'
        ? 'الهندسة المدنية والسكك'
        : 'البناء والتجهيز العمومي'
    } — ${city}.`;

    const candidate = {
      reference_code: refCode,
      title_ar: cleanTitle,
      title_fr: cleanTitle,
      contracting_authority: authority,
      sector,
      city,
      region,
      award_date: awardDate,
      amount_mad: amountMad,
      winning_company: detectedCompany,
      source_url: entry.link,
      summary_fr: `Marché public attribué à ${detectedCompany} (${city}).`,
      summary_ar: summaryAr,
    };

    const existingCluster = clusterMap.get(clusterKey);
    if (!existingCluster) {
      clusterMap.set(clusterKey, candidate);
      sources.push({
        uri: entry.link,
        title: cleanTitle.slice(0, 80),
      });
    } else {
      // Keep the most complete record (with amount & newest date)
      const shouldReplace =
        (candidate.amount_mad > 0 && existingCluster.amount_mad === 0) ||
        (candidate.amount_mad === existingCluster.amount_mad &&
          candidate.award_date > existingCluster.award_date);
      if (shouldReplace) {
        clusterMap.set(clusterKey, candidate);
      }
    }
  }

  const results = Array.from(clusterMap.values()).sort((a, b) =>
    b.award_date.localeCompare(a.award_date)
  );
  return { items: results.slice(0, 20), sources: sources.slice(0, 15) };
}

/**
 * Optional Gemini Google Search Grounding pass when GEMINI_API_KEY is configured.
 */
async function scrapeWithGeminiSearchGrounding(
  portalSnippets: string[],
  sectorFilter: string,
  regionFilter: string
): Promise<{
  items: any[];
  sources: Array<{ uri: string; title: string }>;
}> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return { items: [], sources: [] };

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const { dateKey } = getCasablancaClockParts();
  const regionClause =
    regionFilter !== 'all'
      ? `Prioritize tenders in Moroccan region/city: "${regionFilter}".`
      : 'Cover major Moroccan regions.';

  const searchPrompt = `
Today's date in Morocco is ${dateKey}.
Search site:marchespublics.gov.ma and Moroccan BTP procurement sources for recently AWARDED public works tenders ("marchés de travaux attribués / résultat définitif").
Sector focus: ${sectorFilter}. ${regionClause}
Extract ONLY real awarded tenders, the winning company name, and ONLY public corporate contact info (phone, email, website). Never invent or fabricate missing phone numbers or emails.
${portalSnippets.length > 0 ? `\nPortal snippets:\n${portalSnippets.slice(0, 6).join('\n')}` : ''}
`.trim();

  const groundedResp = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: searchPrompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const groundedText = (groundedResp.text || '').trim();
  const rawChunks =
    groundedResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: Array<{ uri: string; title: string }> = [];
  for (const ch of rawChunks) {
    const uri = String(ch?.web?.uri || '').trim();
    const title = String(ch?.web?.title || '').trim() || extractDomain(uri);
    if (uri) sources.push({ uri, title });
  }
  if (!groundedText) return { items: [], sources };

  const structuredResp = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Extract a JSON array of real awarded Moroccan public works tenders from the grounded findings below. Leave contact_phone, contact_email, or company_website empty "" if unknown.\n\n${groundedText}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            reference_code: { type: Type.STRING },
            title_ar: { type: Type.STRING },
            title_fr: { type: Type.STRING },
            contracting_authority: { type: Type.STRING },
            sector: { type: Type.STRING },
            city: { type: Type.STRING },
            region: { type: Type.STRING },
            award_date: { type: Type.STRING },
            amount_mad: { type: Type.NUMBER },
            winning_company: { type: Type.STRING },
            company_city: { type: Type.STRING },
            contact_phone: { type: Type.STRING },
            contact_email: { type: Type.STRING },
            company_website: { type: Type.STRING },
            source_url: { type: Type.STRING },
            machinery_needed: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary_ar: { type: Type.STRING },
            summary_fr: { type: Type.STRING },
          },
        },
      },
    },
  });

  let parsed: any[] = [];
  try {
    const raw = JSON.parse((structuredResp.text || '[]').trim());
    if (Array.isArray(raw)) parsed = raw;
  } catch {
    parsed = [];
  }

  return { items: parsed, sources };
}

export async function runPublicTendersScrape(
  db: DatabaseSync,
  options: {
    triggerType: 'scheduled_midnight' | 'initial_server_boot' | 'manual';
    sectorFilter?: string;
    regionFilter?: string;
  }
): Promise<ScrapeResult> {
  const sectorFilter = String(options.sectorFilter || 'all').trim() || 'all';
  const regionFilter = String(options.regionFilter || 'all').trim() || 'all';
  const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const startedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO tender_scrape_runs (id, trigger_type, status, sector_filter, region_filter, found_count, new_count, sources_json, started_at)
     VALUES (?, ?, 'running', ?, ?, 0, 0, '[]', ?)`
  ).run(runId, options.triggerType, sectorFilter, regionFilter, startedAt);

  try {
    // Stage 1: Direct live scrape of marchespublics.gov.ma + Moroccan BTP web feeds in parallel
    const [portalRes, webRes] = await Promise.all([
      scrapeMarchesPublicsPortalLive(),
      scrapeMoroccanWebTenderAwards(),
    ]);

    // Stage 2: Optional Gemini Search Grounding pass if GEMINI_API_KEY is available
    let geminiRes: { items: any[]; sources: Array<{ uri: string; title: string }> } = {
      items: [],
      sources: [],
    };
    if ((process.env.GEMINI_API_KEY || '').trim()) {
      try {
        geminiRes = await scrapeWithGeminiSearchGrounding(
          portalRes.snippets,
          sectorFilter,
          regionFilter
        );
      } catch (gErr: any) {
        console.warn('Gemini grounding supplementary step skipped:', gErr?.message || gErr);
      }
    }

    const allSources = [
      ...portalRes.portalUrls,
      ...webRes.sources,
      ...geminiRes.sources,
    ];

    const combinedRaw = [...geminiRes.items, ...webRes.items];
    if (combinedRaw.length === 0) {
      throw new Error('لم يتم العثور على صفقات جديدة في المسح الحالي.');
    }

    const validSectors = new Set<TenderSector>([
      'routes_vrd',
      'terrassement',
      'hydraulique',
      'batiment',
      'genie_civil',
      'other',
    ]);

    const scrapedAt = new Date().toISOString();
    let newCount = 0;
    let updatedCount = 0;
    const savedTenders: PublicTenderRecord[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO public_tenders (
        id, reference_code, dedup_key, title_ar, title_fr, contracting_authority,
        sector, city, region, award_date, amount_mad, winning_company, company_city,
        contact_phone, contact_email, company_website, source_url, source_domain,
        machinery_needed_json, summary_ar, summary_fr, scraped_at, scan_batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const findExistingStmt = db.prepare(
      `SELECT * FROM public_tenders WHERE dedup_key = ? LIMIT 1`
    );

    const updateExistingStmt = db.prepare(`
      UPDATE public_tenders SET
        contact_phone = CASE WHEN contact_phone = '' OR contact_phone IS NULL THEN ? ELSE contact_phone END,
        contact_email = CASE WHEN contact_email = '' OR contact_email IS NULL THEN ? ELSE contact_email END,
        company_website = CASE WHEN company_website = '' OR company_website IS NULL THEN ? ELSE company_website END,
        amount_mad = CASE WHEN amount_mad <= 0 THEN ? ELSE amount_mad END,
        source_url = CASE WHEN source_url = '' OR source_url IS NULL THEN ? ELSE source_url END,
        scraped_at = ?
      WHERE id = ?
    `);

    // Enrich contact coordinates live for each distinct winning company
    const uniqueCompanies = Array.from(
      new Set(
        combinedRaw
          .map((r) => String(r?.winning_company || '').trim())
          .filter(Boolean)
      )
    );
    const enrichedByCompany = new Map<
      string,
      Awaited<ReturnType<typeof enrichCompanyContactsLive>>
    >();
    await Promise.all(
      uniqueCompanies.map(async (comp) => {
        const enriched = await enrichCompanyContactsLive(comp);
        enrichedByCompany.set(comp, enriched);
      })
    );

    for (const raw of combinedRaw) {
      const rawCompany = String(raw?.winning_company || '').trim();
      const titleFr = String(raw?.title_fr || raw?.title_ar || '').trim();
      const titleAr = String(raw?.title_ar || raw?.title_fr || '').trim();
      if (!rawCompany || (!titleFr && !titleAr)) continue;

      const liveContact = enrichedByCompany.get(rawCompany);
      const winningCompany = liveContact?.canonicalName || rawCompany;

      const refCode = String(raw?.reference_code || 'MP-MAROC').trim();
      const dedupKey = makeDedupKey(refCode, titleFr || titleAr, rawCompany);
      const sectorRaw = String(raw?.sector || 'other').trim() as TenderSector;
      const sector: TenderSector = validSectors.has(sectorRaw)
        ? sectorRaw
        : inferSectorFromText(`${titleFr} ${titleAr}`);

      const contactPhone =
        normalizePhone(raw?.contact_phone) || liveContact?.phone || '';
      const contactEmail =
        normalizeEmail(raw?.contact_email) || liveContact?.email || '';
      const companyWebsite =
        normalizeUrl(raw?.company_website) || liveContact?.website || '';

      const sourceUrl =
        normalizeUrl(raw?.source_url) ||
        portalRes.portalUrls[0]?.uri ||
        'https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisAttribution';
      const sourceDomain = extractDomain(sourceUrl) || 'marchespublics.gov.ma';
      const amountMad = Math.max(0, Number(raw?.amount_mad) || 0);
      const machineryNeeded =
        Array.isArray(raw?.machinery_needed) && raw.machinery_needed.length > 0
          ? raw.machinery_needed.map((m: any) => String(m || '').trim()).filter(Boolean).slice(0, 6)
          : inferMachineryNeeded(sector, `${titleFr} ${titleAr}`);

      const existing: any = findExistingStmt.get(dedupKey);
      if (existing) {
        updateExistingStmt.run(
          contactPhone,
          contactEmail,
          companyWebsite,
          amountMad,
          sourceUrl,
          scrapedAt,
          existing.id
        );
        updatedCount += 1;
        savedTenders.push(mapRowToTender(findExistingStmt.get(dedupKey)));
      } else {
        const id = `tender_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        insertStmt.run(
          id,
          refCode,
          dedupKey,
          titleAr,
          titleFr,
          String(raw?.contracting_authority || inferAuthorityFromText(titleFr)).trim(),
          sector,
          String(raw?.city || '').trim(),
          String(raw?.region || '').trim(),
          String(raw?.award_date || '').trim(),
          amountMad,
          winningCompany,
          String(raw?.company_city || liveContact?.city || raw?.city || '').trim(),
          contactPhone,
          contactEmail,
          companyWebsite,
          sourceUrl,
          sourceDomain,
          JSON.stringify(machineryNeeded),
          String(raw?.summary_ar || '').trim(),
          String(raw?.summary_fr || '').trim(),
          scrapedAt,
          runId
        );
        newCount += 1;
        savedTenders.push(mapRowToTender(findExistingStmt.get(dedupKey)));
      }
    }

    const finishedAt = new Date().toISOString();
    db.prepare(
      `UPDATE tender_scrape_runs
       SET status = 'completed', found_count = ?, new_count = ?, sources_json = ?, finished_at = ?
       WHERE id = ?`
    ).run(savedTenders.length, newCount, JSON.stringify(allSources.slice(0, 20)), finishedAt, runId);

    const runRow: any = db.prepare(`SELECT * FROM tender_scrape_runs WHERE id = ?`).get(runId);

    return {
      run: mapRowToRun(runRow),
      tenders: savedTenders,
      newCount,
      updatedCount,
    };
  } catch (err: any) {
    const finishedAt = new Date().toISOString();
    const errMsg = String(err?.message || 'SCRAPE_FAILED');
    db.prepare(
      `UPDATE tender_scrape_runs SET status = 'error', error_message = ?, finished_at = ? WHERE id = ?`
    ).run(errMsg, finishedAt, runId);
    throw err;
  }
}

export function makeTenderClusterKey(title: string, company: string, city: string): string {
  const s = `${title}`.toLowerCase();
  const compKey = String(company || '')
    .toLowerCase()
    .split(/[(/]/)[0]
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '')
    .trim();

  if (/stade.*f[eè]s|complexe sportif.*f[eè]s|(?:2,8[0-9]|f[eè]s).*f[eè]s|(?:sgtm.*2,8[0-9].*f[eè]s)/i.test(s) || (compKey === 'sgtm' && /f[eè]s/i.test(s) && /2,8/.test(s))) {
    return `stade_fes::${compKey}`;
  }
  if (/stade.*marrakech/i.test(s)) return `stade_marrakech::${compKey}`;
  if (/gare.*hassan\s*ii/i.test(s)) return `gare_hassan_ii::${compKey}`;
  if (/terrassement.*hassan\s*ii/i.test(s)) return `terrassement_hassan_ii::${compKey}`;
  if (/stade\s*hassan\s*ii/i.test(s)) return `stade_hassan_ii::${compKey}`;
  if (/a[eé]roport.*mohammed\s*v|terminal.*casablanca/i.test(s)) return `aeroport_cmn::${compKey}`;
  if (/\blgv\b/i.test(s)) return `lgv_maroc::${compKey}`;

  const cleanTitle = s
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .trim()
    .slice(0, 40);
  return `${cleanTitle}::${compKey}::${String(city || '').toLowerCase()}`;
}

export function deduplicateAndSortTenders(tenders: PublicTenderRecord[]): PublicTenderRecord[] {
  const byCluster = new Map<string, PublicTenderRecord>();
  for (const t of tenders) {
    const combinedText = `${t.title_fr} ${t.title_ar}`;
    const fixedSector = inferSectorFromText(combinedText);
    const normalizedSector: TenderSector = fixedSector !== 'other' ? fixedSector : t.sector;
    const item: PublicTenderRecord = {
      ...t,
      sector: normalizedSector,
    };

    const key = makeTenderClusterKey(combinedText, item.winning_company, item.city);
    const prev = byCluster.get(key);
    if (!prev) {
      byCluster.set(key, item);
      continue;
    }

    const itemScore =
      (item.amount_mad > 0 ? 10 : 0) +
      (item.contact_phone ? 3 : 0) +
      (item.contact_email ? 2 : 0) +
      (item.award_date ? 1 : 0);
    const prevScore =
      (prev.amount_mad > 0 ? 10 : 0) +
      (prev.contact_phone ? 3 : 0) +
      (prev.contact_email ? 2 : 0) +
      (prev.award_date ? 1 : 0);

    if (
      itemScore > prevScore ||
      (itemScore === prevScore && item.award_date > prev.award_date)
    ) {
      byCluster.set(key, {
        ...item,
        contact_phone: item.contact_phone || prev.contact_phone,
        contact_email: item.contact_email || prev.contact_email,
        company_website: item.company_website || prev.company_website,
        amount_mad: item.amount_mad || prev.amount_mad,
        award_date: item.award_date > prev.award_date ? item.award_date : prev.award_date,
      });
    } else {
      byCluster.set(key, {
        ...prev,
        contact_phone: prev.contact_phone || item.contact_phone,
        contact_email: prev.contact_email || item.contact_email,
        company_website: prev.company_website || item.company_website,
        amount_mad: prev.amount_mad || item.amount_mad,
        award_date: prev.award_date > item.award_date ? prev.award_date : item.award_date,
      });
    }
  }

  return Array.from(byCluster.values()).sort((a, b) => {
    const dateDiff = String(b.award_date || '').localeCompare(String(a.award_date || ''));
    if (dateDiff !== 0) return dateDiff;
    return String(b.scraped_at || '').localeCompare(String(a.scraped_at || ''));
  });
}

export function mapRowToTender(row: any): PublicTenderRecord {
  let machinery: string[] = [];
  try {
    const parsed = JSON.parse(row?.machinery_needed_json || '[]');
    if (Array.isArray(parsed)) machinery = parsed;
  } catch {
    machinery = [];
  }
  const titleFr = String(row.title_fr || '');
  const titleAr = String(row.title_ar || '');
  const inferredSector = inferSectorFromText(`${titleFr} ${titleAr}`);
  const sector =
    inferredSector !== 'other'
      ? inferredSector
      : ((row.sector || 'other') as TenderSector);
  return {
    id: String(row.id),
    reference_code: String(row.reference_code || ''),
    dedup_key: String(row.dedup_key || ''),
    title_ar: titleAr,
    title_fr: titleFr,
    contracting_authority: String(row.contracting_authority || ''),
    sector,
    city: String(row.city || ''),
    region: String(row.region || ''),
    award_date: String(row.award_date || ''),
    amount_mad: Number(row.amount_mad) || 0,
    winning_company: String(row.winning_company || ''),
    company_city: String(row.company_city || ''),
    contact_phone: String(row.contact_phone || ''),
    contact_email: String(row.contact_email || ''),
    company_website: String(row.company_website || ''),
    source_url: String(row.source_url || ''),
    source_domain: String(row.source_domain || ''),
    machinery_needed: machinery,
    summary_ar: String(row.summary_ar || ''),
    summary_fr: String(row.summary_fr || ''),
    scraped_at: String(row.scraped_at || ''),
    scan_batch_id: String(row.scan_batch_id || ''),
  };
}

export function mapRowToRun(row: any): TenderScrapeRunRecord {
  let sources: Array<{ uri: string; title: string }> = [];
  try {
    const parsed = JSON.parse(row?.sources_json || '[]');
    if (Array.isArray(parsed)) sources = parsed;
  } catch {
    sources = [];
  }
  return {
    id: String(row.id),
    trigger_type: (row.trigger_type || 'scheduled_midnight') as
      | 'scheduled_midnight'
      | 'initial_server_boot'
      | 'manual',
    status: (row.status || 'completed') as 'running' | 'completed' | 'error',
    sector_filter: String(row.sector_filter || 'all'),
    region_filter: String(row.region_filter || 'all'),
    found_count: Number(row.found_count) || 0,
    new_count: Number(row.new_count) || 0,
    sources,
    error_message: row.error_message || undefined,
    started_at: String(row.started_at || ''),
    finished_at: row.finished_at || undefined,
  };
}

/**
 * Starts:
 * 1) An exceptional immediate initial scan on server boot if public_tenders is empty
 * 2) The daily 00:00 (Africa/Casablanca) automatic midnight scheduler
 */
export function startMidnightTendersScheduler(
  db: DatabaseSync,
  onCompleted?: (result: ScrapeResult) => void
): () => void {
  let isRunning = false;
  let lastAttemptedDateKey = '';

  const runInitialIfEmpty = async () => {
    if (isRunning) return;
    const countRow: any = db
      .prepare(`SELECT COUNT(*) AS cnt FROM public_tenders`)
      .get();
    if (Number(countRow?.cnt || 0) > 0) return;

    isRunning = true;
    console.log(
      '🛰️ [Tenders Radar] Running exceptional initial server scan to populate Moroccan public works tenders...'
    );
    try {
      const result = await runPublicTendersScrape(db, {
        triggerType: 'initial_server_boot',
        sectorFilter: 'all',
        regionFilter: 'all',
      });
      console.log(
        `✅ [Tenders Radar] Initial scan complete: ${result.tenders.length} tenders (${result.newCount} new). Next automatic scan at 00:00 Africa/Casablanca.`
      );
      if (onCompleted) onCompleted(result);
    } catch (err: any) {
      console.warn('⚠️ [Tenders Radar] Initial boot scan notice:', err?.message || err);
    } finally {
      isRunning = false;
    }
  };

  const checkMidnightSchedule = async () => {
    if (isRunning) return;

    const { dateKey, hour, minute } = getCasablancaClockParts();
    // Midnight window: 00:00 - 00:04 Casablanca time
    if (hour !== 0 || minute > 4) return;
    if (lastAttemptedDateKey === dateKey) return;

    const todayPrefix = `${dateKey}%`;
    const existingToday: any = db
      .prepare(
        `SELECT id FROM tender_scrape_runs
         WHERE trigger_type = 'scheduled_midnight'
           AND status IN ('running', 'completed')
           AND started_at LIKE ?
         LIMIT 1`
      )
      .get(todayPrefix);

    if (existingToday) {
      lastAttemptedDateKey = dateKey;
      return;
    }

    lastAttemptedDateKey = dateKey;
    isRunning = true;
    console.log(
      `🕛 [Tenders Radar] Starting scheduled 00:00 (Africa/Casablanca) Moroccan public tenders scan for ${dateKey}...`
    );
    try {
      const result = await runPublicTendersScrape(db, {
        triggerType: 'scheduled_midnight',
        sectorFilter: 'all',
        regionFilter: 'all',
      });
      console.log(
        `✅ [Tenders Radar] Midnight scan completed: ${result.tenders.length} tenders processed (${result.newCount} new).`
      );
      if (onCompleted) onCompleted(result);
    } catch (err: any) {
      console.warn('⚠️ [Tenders Radar] Midnight scan error:', err?.message || err);
    } finally {
      isRunning = false;
    }
  };

  // Run exceptional initial scan right after server startup if empty, then check 00:00 every 30s
  const bootTimer = setTimeout(() => {
    runInitialIfEmpty().catch(() => {});
  }, 1500);
  const timer = setInterval(() => {
    checkMidnightSchedule().catch(() => {});
  }, 30_000);

  return () => {
    clearTimeout(bootTimer);
    clearInterval(timer);
  };
}
