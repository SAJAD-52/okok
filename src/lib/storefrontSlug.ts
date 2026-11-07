// ============================================================================
// JADIJCB: Storefront Slug & Asset Helpers
// Generates unique, non-repeating, URL-safe slugs for machinery owners
// ============================================================================

const ARABIC_TO_LATIN_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ء': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h',
  'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'ch', 'ص': 's', 'ض': 'd', 'ط': 't',
  'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'k',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h',
  'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e',
  'ؤ': 'o', 'پ': 'p', 'چ': 'ch', 'ڤ': 'v', 'گ': 'g',
};

/**
 * Transliterates Arabic and French characters to clean ASCII
 */
export function transliterateToAscii(input: string): string {
  if (!input) return '';

  // 1. Replace Arabic letters
  let text = input.trim();
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (ARABIC_TO_LATIN_MAP[char]) {
      result += ARABIC_TO_LATIN_MAP[char];
    } else {
      result += char;
    }
  }

  // 2. Normalize French accents (é -> e, ç -> c, etc.)
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 3. Lowercase & clean symbols
  result = result
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return result;
}

/**
 * Generates a collision-resistant 4-to-5 character alphanumeric unique suffix
 */
export function generateUniqueSuffix(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'; // readable charset without ambiguous 0/o/1/l
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return suffix;
}

/**
 * Automatically creates a unique, non-repeating storefront slug
 * Example: "Atlas Terrassement" -> "atlas-terrassement-8f2a"
 * Example: "أمين للأشغال" -> "amin-llachghal-4k9m"
 */
export function generateUniqueStorefrontSlug(baseName?: string): string {
  const rawBase = baseName ? transliterateToAscii(baseName) : '';
  const cleanBase = rawBase.length > 2 ? rawBase.slice(0, 28) : 'jadijcb-store';
  const suffix = generateUniqueSuffix();
  return `${cleanBase}-${suffix}`;
}

/**
 * Reads a File as a base64 Data URL
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
