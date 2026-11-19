// ============================================================================
// JADIJCB: Moroccan Public Works Tenders Scraper & Midnight 00:00 Scheduler
// Exclusively for Machinery Owners — Scans marchespublics.gov.ma & Moroccan
// BTP web sources using direct HTTP + Gemini Google Search Grounding.
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
  trigger_type: 'scheduled_midnight' | 'manual';
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

function createGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    const err: any = new Error('GEMINI_API_KEY is not configured on the server.');
    err.code = 'GEMINI_API_KEY_MISSING';
    err.status = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
  return v;
}

function normalizePhone(raw?: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  const digits = v.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
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
      .slice(0, 80);
  const r = clean(refCode);
  const c = clean(company);
  if (r && r.length >= 4 && c) return `${r}::${c}`;
  return `${clean(title)}::${c}`;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Direct HTTP probe of the Moroccan Public Procurement Portal (marchespublics.gov.ma).
 * Extracts visible consultation / attribution text blocks when reachable.
 */
async function probeMarchesPublicsPortal(): Promise<{
  snippets: string[];
  fetchedUrls: string[];
}> {
  const targetUrls = [
    'https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAccueil',
    'https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&searchAnnCons',
  ];

  const snippets: string[] = [];
  const fetchedUrls: string[] = [];

  await Promise.all(
    targetUrls.map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'fr-MA,fr;q=0.9,ar-MA;q=0.8',
          },
        });
        if (!resp.ok) return;
        const html = await resp.text();
        if (!html || html.length < 300) return;
        const text = stripHtmlToText(html);
        if (text.length > 100) {
          fetchedUrls.push(url);
          snippets.push(`Source (${url}): ${text.slice(0, 3500)}`);
        }
      } catch {
        // Portal may timeout or restrict non-browser session; search grounding handles live index
      } finally {
        clearTimeout(timer);
      }
    })
  );

  return { snippets, fetchedUrls };
}

function getSectorKeywords(sector?: string): { ar: string; fr: string } {
  switch (sector) {
    case 'routes_vrd':
      return {
        ar: 'طرق، مسالك قروية، تهيئة حضرية، تزفيت وبنية تحتية',
        fr: 'travaux routiers, voirie, VRD, revêtement, pistes rurales',
      };
    case 'terrassement':
      return {
        ar: 'أشغال الحفر والردم وتهيئة الأراضي والمناطق الصناعية',
        fr: 'terrassement, excavation, déblai, remblai, plateforme',
      };
    case 'hydraulique':
      return {
        ar: 'السدود، قنوات الري، الماء الصالح للشرب والتطهير السائل',
        fr: 'hydraulique, assainissement, AEP, barrage, canalisation',
      };
    case 'batiment':
      return {
        ar: 'بناء المؤسسات العمومية والمستشفيات والمركبات',
        fr: 'construction bâtiment public, gros œuvre, équipements publics',
      };
    case 'genie_civil':
      return {
        ar: 'المنشآت الفنية، القناطر، الموانئ والسكك الحديدية',
        fr: 'génie civil, ouvrages d’art, ponts, travaux ferroviaires ou portuaires',
      };
    default:
      return {
        ar: 'جميع أشغال البناء والأشغال العمومية والطرق والحفر والتهيئة',
        fr: 'travaux publics, BTP, routes, terrassement, VRD, hydraulique, génie civil',
      };
  }
}

export async function runPublicTendersScrape(
  db: DatabaseSync,
  options: {
    triggerType: 'scheduled_midnight' | 'manual';
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
    const ai = createGeminiClient();

    // 1. Direct portal probe (best effort)
    const portalProbe = await probeMarchesPublicsPortal();

    // 2. Live Google Search Grounding across marchespublics.gov.ma & Moroccan BTP web
    const sectorKw = getSectorKeywords(sectorFilter);
    const regionClause =
      regionFilter !== 'all'
        ? `Prioritize tenders located in or around the Moroccan region/city: "${regionFilter}".`
        : 'Cover major Moroccan regions (Casablanca-Settat, Rabat-Salé-Kénitra, Marrakech-Safi, Tanger-Tétouan-Al Hoceïma, Fès-Meknès, Souss-Massa, Oriental, Béni Mellal-Khénifra, Drâa-Tafilalet).';

    const { dateKey } = getCasablancaClockParts();

    const searchPrompt = `
Today's date in Morocco is ${dateKey}.
You are an investigative Moroccan public procurement (Marchés Publics) and BTP business intelligence researcher.

OBJECTIVE:
Search the Moroccan web — specifically prioritizing the official Moroccan public procurement portal (site:marchespublics.gov.ma) as well as official Moroccan awarding notices (equipement.gov.ma, adm.co.ma, oncf.ma, alomrane.gov.ma, marsamaroc.co.ma, medias24, lematin, BTP award publications) AND Moroccan business directories (charika.ma, telecontact.ma, kerix.net, official company websites) — to extract REAL awarded/attributed Moroccan public works tenders ("صفقات الأشغال العمومية التي مرت / marchés de travaux attribués").

FOCUS SECTORS:
${sectorKw.fr} (${sectorKw.ar})
${regionClause}

FOR EACH REAL AWARDED PUBLIC WORKS TENDER FOUND:
1. Official tender reference number (e.g. AO N° .../2025 or .../2026) and exact project title (in French and Arabic).
2. Contracting authority / Maître d'ouvrage (Ministry, Wilaya, Commune, Agency, Office).
3. City and Moroccan Region.
4. Attribution / Award date (or publication date) and awarded contract amount in MAD if published.
5. Exact Winning Company name (Société attributaire / الشركة الفائزة).
6. ONLY the winning company's public corporate contact coordinates verified on the Moroccan web (telecontact.ma, charika.ma, official website, etc.):
   - Corporate phone number(s) (fixed or business mobile)
   - Corporate email address
   - Corporate official website URL
7. Practical heavy construction machinery likely required for that specific tender (e.g. Pelle hydraulique, Tractopelle, Niveleuse, Compacteur, Bulldozer, Camion benne, Grue).
8. Source URL from search results.

STRICT VERIFICATION RULES:
- Extract 8 to 14 REAL, distinct, verified awarded Moroccan BTP public tenders.
- NEVER fabricate or invent phone numbers, emails, websites, or reference codes. If a company's phone, email, or website could not be verified from search results, explicitly state "NOT_FOUND" for that contact field.
- Include ONLY contact info (phone, email, website) for the winning company — no personal/private individual data.
- Provide rich, factual bulleted output with every verified detail and URL.
${
  portalProbe.snippets.length > 0
    ? `\nLive portal text snippets retrieved directly from marchespublics.gov.ma:\n${portalProbe.snippets.join('\n---\n')}`
    : ''
}
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
    const groundingSources: Array<{ uri: string; title: string }> = [];
    const seenUri = new Set<string>();

    for (const u of portalProbe.fetchedUrls) {
      if (!seenUri.has(u)) {
        seenUri.add(u);
        groundingSources.push({
          uri: u,
          title: 'Portail des Marchés Publics (marchespublics.gov.ma)',
        });
      }
    }

    for (const chunk of rawChunks) {
      const uri = String(chunk?.web?.uri || '').trim();
      const title = String(chunk?.web?.title || '').trim() || extractDomain(uri);
      if (uri && !seenUri.has(uri)) {
        seenUri.add(uri);
        groundingSources.push({ uri, title });
      }
    }

    if (!groundedText) {
      throw new Error('لم يتم استرجاع نتائج كافية من مسح الويب المغربي.');
    }

    // 3. Structured JSON extraction strictly grounded in Stage 2 output
    const sourcesContext = groundingSources
      .slice(0, 30)
      .map((s, idx) => `[${idx + 1}] ${s.title} => ${s.uri}`)
      .join('\n');

    const extractionPrompt = `
Convert the following verified Moroccan public procurement search findings into a strict JSON array.
Rules:
- Copy ONLY real tenders, winning companies, phone numbers, emails, websites, amounts, and URLs present in the findings below.
- If phone, email, or website is "NOT_FOUND" or missing, return an empty string "".
- For "sector", choose strictly one of: "routes_vrd", "terrassement", "hydraulique", "batiment", "genie_civil", "other".
- For "title_ar" and "summary_ar", provide accurate, natural Moroccan/Modern Standard Arabic translations if the original notice was only in French, while keeping official French in "title_fr" and "summary_fr".
- For "amount_mad", output numeric MAD amount (e.g. 14500000) or 0 if not disclosed.
- For "source_url", pick the most specific matching URL from the findings or grounding URLs below (or "https://www.marchespublics.gov.ma" as portal base only if directly from the portal).

GROUNDING URLS:
${sourcesContext || 'None'}

FINDINGS:
${groundedText}
`.trim();

    const structuredResp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: extractionPrompt,
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
              machinery_needed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              summary_ar: { type: Type.STRING },
              summary_fr: { type: Type.STRING },
            },
            required: [
              'reference_code',
              'title_ar',
              'title_fr',
              'contracting_authority',
              'sector',
              'city',
              'winning_company',
            ],
          },
        },
      },
    });

    const jsonText = (structuredResp.text || '[]').trim();
    let parsedItems: any[] = [];
    try {
      parsedItems = JSON.parse(jsonText);
      if (!Array.isArray(parsedItems)) parsedItems = [];
    } catch {
      parsedItems = [];
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

    for (const raw of parsedItems) {
      const winningCompany = String(raw?.winning_company || '').trim();
      const titleFr = String(raw?.title_fr || raw?.title_ar || '').trim();
      const titleAr = String(raw?.title_ar || raw?.title_fr || '').trim();
      if (!winningCompany || (!titleFr && !titleAr)) continue;

      const refCode = String(raw?.reference_code || 'AO-MAROC').trim();
      const dedupKey = makeDedupKey(refCode, titleFr || titleAr, winningCompany);
      const sectorRaw = String(raw?.sector || 'other').trim() as TenderSector;
      const sector: TenderSector = validSectors.has(sectorRaw) ? sectorRaw : 'other';

      const contactPhone = normalizePhone(raw?.contact_phone);
      const contactEmail = normalizeEmail(raw?.contact_email);
      const companyWebsite = normalizeUrl(raw?.company_website);
      const sourceUrl =
        normalizeUrl(raw?.source_url) ||
        groundingSources[0]?.uri ||
        'https://www.marchespublics.gov.ma';
      const sourceDomain = extractDomain(sourceUrl) || 'marchespublics.gov.ma';
      const amountMad = Math.max(0, Number(raw?.amount_mad) || 0);
      const machineryNeeded = Array.isArray(raw?.machinery_needed)
        ? raw.machinery_needed.map((m: any) => String(m || '').trim()).filter(Boolean).slice(0, 6)
        : [];

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
          String(raw?.contracting_authority || 'جهة عمومية مغربية').trim(),
          sector,
          String(raw?.city || '').trim(),
          String(raw?.region || '').trim(),
          String(raw?.award_date || '').trim(),
          amountMad,
          winningCompany,
          String(raw?.company_city || raw?.city || '').trim(),
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
    ).run(savedTenders.length, newCount, JSON.stringify(groundingSources), finishedAt, runId);

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

export function mapRowToTender(row: any): PublicTenderRecord {
  let machinery: string[] = [];
  try {
    const parsed = JSON.parse(row?.machinery_needed_json || '[]');
    if (Array.isArray(parsed)) machinery = parsed;
  } catch {
    machinery = [];
  }
  return {
    id: String(row.id),
    reference_code: String(row.reference_code || ''),
    dedup_key: String(row.dedup_key || ''),
    title_ar: String(row.title_ar || ''),
    title_fr: String(row.title_fr || ''),
    contracting_authority: String(row.contracting_authority || ''),
    sector: (row.sector || 'other') as TenderSector,
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
    trigger_type: (row.trigger_type || 'manual') as 'scheduled_midnight' | 'manual',
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
 * Starts the daily 00:00 (Africa/Casablanca) background cron scheduler.
 * Uses a 30-second check interval and tracks Casablanca calendar date so each
 * midnight trigger runs reliably once per day at 00:00 Morocco time.
 */
export function startMidnightTendersScheduler(
  db: DatabaseSync,
  onCompleted?: (result: ScrapeResult) => void
): () => void {
  let isRunning = false;
  let lastAttemptedDateKey = '';

  const checkAndTrigger = async () => {
    if (isRunning) return;
    if (!(process.env.GEMINI_API_KEY || '').trim()) return;

    const { dateKey, hour, minute } = getCasablancaClockParts();
    // Midnight window: 00:00 - 00:04 Casablanca time
    if (hour !== 0 || minute > 4) return;
    if (lastAttemptedDateKey === dateKey) return;

    // Check DB so server restarts during 00:00-00:04 don't duplicate today's midnight scan
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
    console.log(`🕛 [Tenders Radar] Starting scheduled 00:00 (Africa/Casablanca) Moroccan public tenders scan for ${dateKey}...`);
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

  const timer = setInterval(checkAndTrigger, 30_000);
  // Also check once shortly after startup in case server booted right at 00:00-00:04
  const bootTimer = setTimeout(checkAndTrigger, 5_000);

  return () => {
    clearInterval(timer);
    clearTimeout(bootTimer);
  };
}
