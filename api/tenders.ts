// ============================================================================
// JADIJCB: Vercel Serverless API — Public Moroccan Public Works Tenders (/api/tenders)
// Runs on server side (with daily 00:00 Vercel Cron + Edge CDN caching) so
// jadijcb.com/tenders always loads real awarded Moroccan public works tenders
// and live corporate contact coordinates without any client-side scraping.
// ============================================================================

import crypto from 'crypto';

type TenderSector =
  | 'routes_vrd'
  | 'terrassement'
  | 'hydraulique'
  | 'batiment'
  | 'genie_civil'
  | 'other';

interface PublicTenderItem {
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

const MOROCCO_TZ = 'Africa/Casablanca';

function getCasablancaClockParts(date: Date = new Date()) {
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
  for (const p of parts) map[p.type] = p.value;
  const hourNum = Number(map.hour === '24' ? '0' : map.hour || 0);
  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: hourNum,
    minute: Number(map.minute || 0),
    second: Number(map.second || 0),
  };
}

function getNextMidnightCasablancaIso(now: Date = new Date()): string {
  const { hour, minute, second } = getCasablancaClockParts(now);
  const secondsPassedToday = hour * 3600 + minute * 60 + second;
  const secondsUntilMidnight = Math.max(1, 24 * 3600 - secondsPassedToday);
  return new Date(now.getTime() + secondsUntilMidnight * 1000).toISOString();
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
    pattern: /NGE/i,
    canonicalName: 'NGE Contracting Maroc',
    city: 'الرباط / الدار البيضاء',
    urls: ['https://www.nge.fr/contact/', 'https://www.nge.fr/'],
  },
  {
    pattern: /Colas|GTR/i,
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
    pattern: /SOGEA\s*Maroc/i,
    canonicalName: 'SOGEA Maroc (VINCI Construction)',
    city: 'الدار البيضاء',
    urls: ['https://www.sogeamaroc.com/contact/', 'https://www.sogeamaroc.com/'],
  },
  {
    pattern: /CREC\s*4|China Railway/i,
    canonicalName: 'CREC 4 Maroc (China Railway Fourth Bureau)',
    city: 'القنيطرة / مراكش',
    urls: ['https://www.crec4.com/'],
  },
  {
    pattern: /\bCRBC\b/i,
    canonicalName: 'CRBC Maroc (China Road and Bridge Corporation)',
    city: 'الرباط / الناظور',
    urls: ['https://www.crbc.com/'],
  },
];

function extractContactsFromHtml(html: string): { phone: string; email: string } {
  let phone = '';
  let email = '';

  const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch?.[1]) {
    const cleaned = telMatch[1].replace(/[^\d+\s()-]/g, '').trim();
    if (cleaned.replace(/\D/g, '').length >= 9) phone = cleaned;
  }

  const mailMatch = html.match(/href=["']mailto:([^"'?]+)/i);
  if (mailMatch?.[1]) {
    const cleaned = mailMatch[1].trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned) && !/example|sentry|wix/i.test(cleaned)) {
      email = cleaned;
    }
  }

  const text = stripHtmlToText(html);
  if (!phone) {
    const phoneMatch = text.match(
      /(?:\+212|00212|0[567])[\s.-]?(?:\d[\s.-]?){8,9}/
    );
    if (phoneMatch?.[0]) {
      const candidate = phoneMatch[0].replace(/\s+/g, ' ').trim();
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 9 && digits.length <= 13) phone = candidate;
    }
  }
  if (!email) {
    const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const candidate of emailMatches) {
      const lower = candidate.toLowerCase();
      if (!/example|sentry|wix|wordpress|noreply|@2x|\.png|\.jpg/i.test(lower)) {
        email = lower;
        break;
      }
    }
  }
  return { phone, email };
}

async function enrichCompanyContactsLive(companyName: string) {
  const matched = KNOWN_COMPANY_WEB_CANDIDATES.find((c) => c.pattern.test(companyName));
  if (!matched) {
    return { canonicalName: companyName, phone: '', email: '', website: '', city: '' };
  }

  let phone = '';
  let email = '';
  let website = '';

  for (const url of matched.urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      if (!resp.ok) continue;
      if (!website) website = new URL(resp.url || url).origin;
      const html = await resp.text();
      if (!html || html.length < 150) continue;
      const extracted = extractContactsFromHtml(html);
      if (!phone && extracted.phone) phone = extracted.phone;
      if (!email && extracted.email) email = extracted.email;
      if (phone && email) break;
    } catch {
      // ignore timeout
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    canonicalName: matched.canonicalName,
    phone,
    email,
    website,
    city: matched.city,
  };
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

function inferMachineryNeeded(sector: TenderSector): string[] {
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
      return ['حفارة هيدروليكية (Pelle)', 'تراكتور جرافة (Tractopelle)', 'شاحنة قلابة'];
  }
}

function parseAmountMadFromText(text: string): number {
  const norm = text.replace(/\s+/g, ' ');
  const mmdh = norm.match(/([\d]+(?:[.,]\d+)?)\s*(?:mmdh|milliards?\s*(?:de\s*)?(?:dh|dirhams|mad))/i);
  if (mmdh) return Math.round(parseFloat(mmdh[1].replace(',', '.')) * 1_000_000_000);
  const mdh = norm.match(/([\d]+(?:[.,]\d+)?)\s*(?:mdh|millions?\s*(?:de\s*)?(?:dh|dirhams|mad))/i);
  if (mdh) return Math.round(parseFloat(mdh[1].replace(',', '.')) * 1_000_000);
  const eur = norm.match(/([\d]+(?:[.,]\d+)?)\s*(?:m€|millions?\s*d['’]?euros)/i);
  if (eur) return Math.round(parseFloat(eur[1].replace(',', '.')) * 10_800_000);
  return 0;
}

function extractCityAndRegion(text: string): { city: string; region: string } {
  const mappings: Array<{ rx: RegExp; city: string; region: string }> = [
    { rx: /benslimane|stade\s*hassan\s*ii|بنسليمان/i, city: 'بنسليمان', region: 'الدار البيضاء - سطات' },
    { rx: /casablanca|mohammed\s*v|casa|azemmour|الدار البيضاء/i, city: 'الدار البيضاء', region: 'الدار البيضاء - سطات' },
    { rx: /rabat|salé|kénitra|bouregreg|الرباط|القنيطرة/i, city: 'الرباط / القنيطرة', region: 'الرباط - سلا - القنيطرة' },
    { rx: /marrakech|al\s*haouz|ouirgane|مراكش|الحوز/i, city: 'مراكش', region: 'مراكش - آسفي' },
    { rx: /fès|fes|فاس/i, city: 'فاس', region: 'فاس - مكناس' },
    { rx: /tanger|tétouan|al\s*hoceima|ksar\s*sghir|طنجة/i, city: 'طنجة / تطوان', region: 'طنجة - تطوان - الحسيمة' },
    { rx: /agadir|souss|أكادير/i, city: 'أكادير', region: 'سوس - ماسة' },
    { rx: /nador|guercif|oujda|oriental|الناظور|وجدة/i, city: 'الناظور / وجدة', region: 'الشرق' },
    { rx: /azilal|béni\s*mellal|béni-mellal|أزيلال|بني ملال/i, city: 'بني ملال', region: 'بني ملال - خنيفرة' },
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

function makeTenderClusterKey(title: string, company: string, city: string): string {
  const s = title.toLowerCase();
  const compKey = company
    .toLowerCase()
    .split(/[(/]/)[0]
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '')
    .trim();

  if (/stade.*f[eè]s|complexe sportif.*f[eè]s/i.test(s) || (compKey === 'sgtm' && /f[eè]s/i.test(s) && /2,8/.test(s)))
    return `stade_fes::${compKey}`;
  if (/stade.*marrakech/i.test(s)) return `stade_marrakech::${compKey}`;
  if (/gare.*hassan\s*ii/i.test(s)) return `gare_hassan_ii::${compKey}`;
  if (/terrassement.*hassan\s*ii/i.test(s)) return `terrassement_hassan_ii::${compKey}`;
  if (/lot\s*3|3,7/i.test(s) && /hassan\s*ii|benslimane/i.test(s)) return `stade_hassan_ii_lot3::${compKey}`;
  if (/stade\s*hassan\s*ii/i.test(s)) return `stade_hassan_ii::${compKey}`;
  if (/a[eé]roport.*mohammed\s*v|terminal.*casablanca/i.test(s)) return `aeroport_cmn::${compKey}`;
  if (/\blgv\b/i.test(s) && /ksar\s*sghir|162\s*mdh/i.test(s)) return `lgv_ksar_sghir::${compKey}`;
  if (/\blgv\b/i.test(s)) return `lgv_maroc::${compKey}`;
  if (/nador\s*west/i.test(s) && /sbtx|bioui/i.test(s)) return `nador_west_sbtx`;
  if (/guercif.*nador/i.test(s) && /crbc/i.test(s)) return `guercif_nador::crbc`;

  return `${s.replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').trim().slice(0, 40)}::${compKey}::${city.toLowerCase()}`;
}

let cachedResponse: { timestamp: number; tenders: PublicTenderItem[]; lastRun: any } | null = null;
const MEMORY_CACHE_TTL_MS = 25 * 60 * 1000;

async function buildLiveTendersList(): Promise<PublicTenderItem[]> {
  const rssUrls = [
    'https://news.google.com/rss/search?q=(%22march%C3%A9%22+OR+%22lot%22)+(%22attribu%C3%A9%22+OR+%22remport%C3%A9%22+OR+%22d%C3%A9croche%22)+(%22travaux%22+OR+%22terrassement%22+OR+%22barrage%22+OR+%22routes%22+OR+%22VRD%22)+Maroc&hl=fr&gl=MA&ceid=MA:fr',
    'https://news.google.com/rss/search?q=(%22SGTM%22+OR+%22TGCC%22+OR+%22STAM%22+OR+%22Jet+Contractors%22+OR+%22Lamalif%22+OR+%22Houar%22+OR+%22Somagec%22)+(%22march%C3%A9%22+OR+%22travaux%22)+Maroc&hl=fr&gl=MA&ceid=MA:fr',
    'https://news.google.com/rss/search?q=(%22Bioui%22+OR+%22SBTX%22+OR+%22Houar%22+OR+%22GTR%22+OR+%22Mojazine%22+OR+%22NGE%22+OR+%22Colas%22+OR+%22SNCE%22)+(%22march%C3%A9%22+OR+%22travaux%22+OR+%22route%22+OR+%22barrage%22)+Maroc&hl=fr&gl=MA&ceid=MA:fr',
    'https://news.google.com/rss/search?q=(%22autoroute%22+OR+%22barrage%22+OR+%22port%22+OR+%22tramway%22+OR+%22rocade%22+OR+%22CHU%22+OR+%22tr%C3%A9mie%22)+(%22attribu%C3%A9%22+OR+%22remport%C3%A9%22+OR+%22d%C3%A9croche%22)+Maroc&hl=fr&gl=MA&ceid=MA:fr',
  ];

  const rawEntries: Array<{ title: string; link: string; pubDate: string }> = [];

  await Promise.all(
    rssUrls.map(async (rssUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try {
        const resp = await fetch(rssUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!resp.ok) return;
        const xml = await resp.text();
        for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
          const block = m[1];
          const title = decodeHtmlEntities((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
          const link = decodeHtmlEntities((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '');
          const pubDate = decodeHtmlEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '');
          if (title && link) rawEntries.push({ title, link, pubDate });
        }
      } catch {
        // ignore timeout
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const companyDetectors: Array<{ rx: RegExp; name: string }> = [
    { rx: /\bSGTM\s*[-–/et]+\s*TGCC\b/i, name: 'SGTM / TGCC' },
    { rx: /\bSGTM\b/i, name: 'SGTM' },
    { rx: /\bTGCC\b/i, name: 'TGCC' },
    { rx: /\bSTAM\b/i, name: 'STAM' },
    { rx: /SOGEA\s*Maroc/i, name: 'SOGEA Maroc' },
    { rx: /Lamalif/i, name: 'Lamalif Group' },
    { rx: /Jet\s*Contractors/i, name: 'Jet Contractors' },
    { rx: /NGE\s*Contracting|\bNGE\b/i, name: 'NGE Contracting' },
    { rx: /Colas\s*Rail/i, name: 'Colas Rail' },
    { rx: /\bGTR\b/i, name: 'GTR / Colas' },
    { rx: /\bHouar\b/i, name: 'Houar' },
    { rx: /Bioui|SBTX/i, name: 'Bioui Travaux / SBTX' },
    { rx: /Somagec/i, name: 'Somagec' },
    { rx: /Mojazine/i, name: 'Mojazine' },
    { rx: /\bCREC\s*4\b|\bCREC4\b/i, name: 'CREC 4' },
    { rx: /\bCRBC\b/i, name: 'CRBC' },
  ];

  const clusterMap = new Map<string, any>();

  for (const entry of rawEntries) {
    const cleanTitle = entry.title.replace(/\s+-\s+[^-]+(?:\s+-\s+[^-]+)?$/, '').trim();
    const isBtpAward =
      /(marché|lot|travaux|terrassement|barrage|stade|lgv|terminal|gare|aménagement|corniche|trémie|cité sportive|autoroute|pont|port|chu|dragage|ligne ferroviaire)/i.test(
        cleanTitle
      ) &&
      /(attribué|remporté|remporte|décroche|décrochent|confié|retenu|retenues|adjudicataire|achève|lance les travaux)/i.test(
        cleanTitle
      );

    if (!isBtpAward) continue;
    if (/ascenseurs|bus amphibies|bourse|ipo|résultat net|chiffre d['’]affaires|acquiert 60%|dons?|fonds spécial|pablo escobar/i.test(cleanTitle)) {
      continue;
    }

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
    const refHash = crypto.createHash('md5').update(clusterKey).digest('hex').slice(0, 6).toUpperCase();
    const yearTag = awardDate ? awardDate.slice(0, 4) : '2026';
    const refCode = `MP-${yearTag}-${refHash}`;

    const candidate = {
      clusterKey,
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
      summary_ar: `صفقة أشغال عمومية مرصودة للشركة الفائزة (${detectedCompany}) — ${city}.`,
    };

    const existing = clusterMap.get(clusterKey);
    if (!existing) {
      clusterMap.set(clusterKey, candidate);
    } else if (
      (candidate.amount_mad > 0 && existing.amount_mad === 0) ||
      (candidate.amount_mad === existing.amount_mad && candidate.award_date > existing.award_date)
    ) {
      clusterMap.set(clusterKey, candidate);
    }
  }

  const items = Array.from(clusterMap.values())
    .sort((a, b) => b.award_date.localeCompare(a.award_date))
    .slice(0, 26);

  const uniqueCompanies = Array.from(new Set(items.map((i) => i.winning_company)));
  const enrichedMap = new Map<string, Awaited<ReturnType<typeof enrichCompanyContactsLive>>>();
  await Promise.all(
    uniqueCompanies.map(async (c) => {
      enrichedMap.set(c, await enrichCompanyContactsLive(c));
    })
  );

  const nowIso = new Date().toISOString();
  return items.map((item, idx) => {
    const contact = enrichedMap.get(item.winning_company);
    return {
      id: `tender_live_${idx}_${item.reference_code}`,
      reference_code: item.reference_code,
      dedup_key: item.clusterKey,
      title_ar: item.title_ar,
      title_fr: item.title_fr,
      contracting_authority: item.contracting_authority,
      sector: item.sector,
      city: item.city,
      region: item.region,
      award_date: item.award_date,
      amount_mad: item.amount_mad,
      winning_company: contact?.canonicalName || item.winning_company,
      company_city: contact?.city || item.city,
      contact_phone: contact?.phone || '',
      contact_email: contact?.email || '',
      company_website: contact?.website || '',
      source_url: item.source_url,
      source_domain: 'news.google.com',
      machinery_needed: inferMachineryNeeded(item.sector),
      summary_ar: item.summary_ar,
      summary_fr: item.summary_fr,
      scraped_at: nowIso,
      scan_batch_id: `vercel_${nowIso.slice(0, 10)}`,
    };
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const isCron = req.query?.cron === '1' || req.headers?.['x-vercel-cron'] === '1';
    const isFreshEnough =
      !isCron &&
      cachedResponse &&
      Date.now() - cachedResponse.timestamp < MEMORY_CACHE_TTL_MS &&
      cachedResponse.tenders.length > 0;

    let tenders = cachedResponse?.tenders || [];
    let lastRun = cachedResponse?.lastRun || null;

    if (!isFreshEnough) {
      const startedAt = new Date().toISOString();
      tenders = await buildLiveTendersList();
      const finishedAt = new Date().toISOString();
      lastRun = {
        id: `run_vercel_${Date.now()}`,
        trigger_type: isCron ? 'scheduled_midnight' : 'initial_server_boot',
        status: 'completed',
        sector_filter: 'all',
        region_filter: 'all',
        found_count: tenders.length,
        new_count: tenders.length,
        sources: [],
        started_at: startedAt,
        finished_at: finishedAt,
      };
      if (tenders.length > 0) {
        cachedResponse = { timestamp: Date.now(), tenders, lastRun };
      }
    }

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=43200'
    );
    return res.status(200).json({
      success: true,
      tenders,
      runs: lastRun ? [lastRun] : [],
      lastRun,
      isServerScanRunning: false,
      nextMidnightAt: getNextMidnightCasablancaIso(),
      scheduleTimezone: 'Africa/Casablanca',
      scheduleTime: '00:00',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      tenders: [],
      error: err?.message || 'SCRAPE_ERROR',
    });
  }
}
