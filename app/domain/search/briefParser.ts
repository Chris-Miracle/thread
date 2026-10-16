import type { BudgetScope, ParsedBrief, ProductCategory, ShoppingDepartment } from '~/types/thread'

type Climate = NonNullable<ParsedBrief['climate']>

interface LexiconEntry {
  categories: ProductCategory[]
  group: 'clothes' | 'category'
  /** Specific noun worth searching for verbatim, e.g. "sandals". */
  hint?: string
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, pair: 1, three: 3, few: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

// Words that describe the item and belong in its search query: "a black linen shirt".
const DESCRIPTIVE_WORDS = new Set([
  'black', 'white', 'navy', 'blue', 'red', 'green', 'beige', 'tan', 'brown', 'grey', 'gray', 'pink', 'cream', 'olive',
  'khaki', 'yellow', 'orange', 'purple', 'gold', 'silver', 'ivory', 'linen', 'cotton', 'silk', 'wool', 'leather',
  'denim', 'knit', 'crochet', 'satin', 'floral', 'striped', 'oversized', 'relaxed', 'slim', 'maxi', 'midi', 'mini',
  'flowy', 'breezy', 'swim', 'summer', 'winter', 'beach', 'evening', 'casual', 'dressy', 'formal',
])

// Words that may also sit between a quantity and its noun but say nothing searchable: "two pairs of comfy sandals".
const FILLER_WORDS = new Set([
  ...DESCRIPTIVE_WORDS,
  'of', 'pairs', 'new', 'nice', 'cute', 'comfy', 'comfortable', 'light', 'vacation', 'holiday', 'resort', 'travel',
  'cool', 'stylish', 'good', 'great', 'cheap', 'affordable', 'fancy', 'day', 'everyday', 'smart', 'basic', 'simple',
  'more', 'extra', 'different',
])

function entry(categories: ProductCategory[], hint?: string): LexiconEntry {
  return { categories, group: 'category', hint }
}

const CLOTHES: LexiconEntry = { categories: [], group: 'clothes' }

/** Phrases map to categories; multi-word phrases are matched first. Plurals and common misspellings are explicit. */
const LEXICON: Record<string, LexiconEntry> = {
  'clothes': CLOTHES, 'clothing': CLOTHES, 'cloths': CLOTHES, 'outfits': CLOTHES, 'outfit': CLOTHES, 'pieces': CLOTHES,
  'looks': CLOTHES, 'garments': CLOTHES, 'fits': CLOTHES, 'items of clothing': CLOTHES, 'pieces of clothing': CLOTHES,
  'perfume': entry(['fragrance']), 'perfumes': entry(['fragrance']), 'fragrance': entry(['fragrance']),
  'fragrances': entry(['fragrance']), 'cologne': entry(['fragrance'], 'cologne'), 'colognes': entry(['fragrance'], 'cologne'),
  'scent': entry(['fragrance']), 'scents': entry(['fragrance']), 'eau de parfum': entry(['fragrance'], 'eau de parfum'),
  'eau de toilette': entry(['fragrance'], 'eau de toilette'),
  'footwear': entry(['footwear']), 'footwears': entry(['footwear']), 'shoes': entry(['footwear']), 'shoe': entry(['footwear']),
  'sneakers': entry(['footwear'], 'sneakers'), 'trainers': entry(['footwear'], 'sneakers'), 'sandals': entry(['footwear'], 'sandals'),
  'heels': entry(['footwear'], 'heels'), 'boots': entry(['footwear'], 'boots'), 'loafers': entry(['footwear'], 'loafers'),
  'slides': entry(['footwear'], 'slides'), 'espadrilles': entry(['footwear'], 'espadrilles'),
  'flip flops': entry(['footwear'], 'flip flops'), 'flipflops': entry(['footwear'], 'flip flops'),
  'shirt': entry(['tops'], 'shirt'), 'shirts': entry(['tops'], 'shirt'), 'top': entry(['tops'], 'top'), 'tops': entry(['tops'], 'top'),
  'tee': entry(['tops'], 't-shirt'), 'tees': entry(['tops'], 't-shirt'), 't shirt': entry(['tops'], 't-shirt'),
  't shirts': entry(['tops'], 't-shirt'), 'tshirt': entry(['tops'], 't-shirt'), 'tshirts': entry(['tops'], 't-shirt'),
  'blouse': entry(['tops'], 'blouse'), 'blouses': entry(['tops'], 'blouse'), 'polo': entry(['tops'], 'polo shirt'),
  'polos': entry(['tops'], 'polo shirt'), 'sweater': entry(['tops'], 'sweater'), 'sweaters': entry(['tops'], 'sweater'),
  'tank top': entry(['tops'], 'tank top'), 'tank tops': entry(['tops'], 'tank top'),
  'pants': entry(['bottoms'], 'pants'), 'trousers': entry(['bottoms'], 'trousers'), 'jeans': entry(['bottoms'], 'jeans'),
  'shorts': entry(['bottoms'], 'shorts'), 'skirt': entry(['bottoms'], 'skirt'), 'skirts': entry(['bottoms'], 'skirt'),
  'chinos': entry(['bottoms'], 'chinos'),
  'dress': entry(['dresses'], 'dress'), 'dresses': entry(['dresses'], 'dress'), 'sundress': entry(['dresses'], 'sundress'),
  'sundresses': entry(['dresses'], 'sundress'), 'gown': entry(['dresses'], 'gown'), 'gowns': entry(['dresses'], 'gown'),
  'swimsuit': entry(['swimwear'], 'swimsuit'), 'swimsuits': entry(['swimwear'], 'swimsuit'), 'bikini': entry(['swimwear'], 'bikini'),
  'bikinis': entry(['swimwear'], 'bikini'), 'swimwear': entry(['swimwear']), 'swim trunks': entry(['swimwear'], 'swim trunks'),
  'swim shorts': entry(['swimwear'], 'swim shorts'), 'bathing suit': entry(['swimwear'], 'swimsuit'),
  'bathing suits': entry(['swimwear'], 'swimsuit'),
  'jacket': entry(['outerwear'], 'jacket'), 'jackets': entry(['outerwear'], 'jacket'), 'coat': entry(['outerwear'], 'coat'),
  'coats': entry(['outerwear'], 'coat'), 'blazer': entry(['outerwear'], 'blazer'), 'blazers': entry(['outerwear'], 'blazer'),
  'bag': entry(['accessories'], 'bag'), 'bags': entry(['accessories'], 'bag'), 'handbag': entry(['accessories'], 'handbag'),
  'sunglasses': entry(['accessories'], 'sunglasses'), 'hat': entry(['accessories'], 'hat'), 'hats': entry(['accessories'], 'hat'),
  'belt': entry(['accessories'], 'belt'), 'belts': entry(['accessories'], 'belt'), 'jewelry': entry(['accessories'], 'jewelry'),
  'accessory': entry(['accessories'], 'accessory'), 'accessories': entry(['accessories'], 'accessories'),
  'bracelet': entry(['accessories'], 'bracelet'), 'bracelets': entry(['accessories'], 'bracelet'),
  'watch': entry(['accessories'], 'watch'), 'watches': entry(['accessories'], 'watch'),
  'ring': entry(['accessories'], 'ring'), 'rings': entry(['accessories'], 'ring'),
  'earring': entry(['accessories'], 'earring'), 'earrings': entry(['accessories'], 'earring'),
  'necklaces': entry(['accessories'], 'necklace'),
  'jewellery': entry(['accessories'], 'jewelry'), 'necklace': entry(['accessories'], 'necklace'),
  'leggings': entry(['activewear'], 'leggings'), 'sports bra': entry(['activewear'], 'sports bra'),
  'activewear': entry(['activewear']), 'workout set': entry(['activewear'], 'workout set'),
}

const MAX_PHRASE_WORDS = 3

/** Destinations with a clear climate; matched as whole phrases. */
const DESTINATIONS: Record<string, Climate> = {
  'cancun': 'hot', 'tulum': 'hot', 'playa del carmen': 'hot', 'cabo': 'hot', 'los cabos': 'hot', 'puerto vallarta': 'hot',
  'mexico': 'hot', 'miami': 'hot', 'florida': 'hot', 'hawaii': 'hot', 'maui': 'hot', 'honolulu': 'hot', 'bali': 'hot',
  'phuket': 'hot', 'thailand': 'hot', 'jamaica': 'hot', 'bahamas': 'hot', 'punta cana': 'hot', 'dominican republic': 'hot',
  'cuba': 'hot', 'barbados': 'hot', 'aruba': 'hot', 'costa rica': 'hot', 'caribbean': 'hot', 'dubai': 'hot',
  'marrakech': 'hot', 'ibiza': 'hot', 'mykonos': 'hot', 'santorini': 'hot', 'maldives': 'hot', 'fiji': 'hot', 'las vegas': 'hot',
  'banff': 'cold', 'whistler': 'cold', 'iceland': 'cold', 'reykjavik': 'cold', 'lapland': 'cold', 'aspen': 'cold',
  'alaska': 'cold', 'norway': 'cold', 'finland': 'cold', 'zermatt': 'cold', 'chamonix': 'cold',
  'paris': 'mild', 'london': 'mild', 'lisbon': 'mild', 'rome': 'mild', 'barcelona': 'mild', 'new york': 'mild', 'tokyo': 'mild',
}

const CLIMATE_WORDS: Record<Climate, string[]> = {
  hot: ['beach', 'tropical', 'summer', 'hot', 'sunny', 'pool', 'resort'],
  cold: ['ski', 'snow', 'winter', 'cold', 'freezing'],
  mild: ['spring', 'fall', 'autumn'],
}

const TOTAL_CUES = ['budget', 'total', 'overall', 'altogether', 'all in', 'spend', 'everything', 'in total', 'for all']
const EACH_CUES = ['each', 'per item', 'per piece', 'apiece', 'a piece', 'an item', 'per', 'under', 'below', 'less than', 'max', 'maximum', 'up to', 'no more than']

function normalizeText(value: string): string {
  return value.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/-/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/[^a-z0-9$.\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

function modifiersBefore(words: readonly string[], index: number): string[] {
  const modifiers: string[] = []
  for (let cursor = index - 1; cursor >= Math.max(0, index - 3) && DESCRIPTIVE_WORDS.has(words[cursor]!); cursor -= 1) {
    modifiers.unshift(words[cursor]!)
  }
  return modifiers
}

function quantityBefore(words: readonly string[], index: number): number | undefined {
  for (let cursor = index - 1; cursor >= Math.max(0, index - 4); cursor -= 1) {
    const word = words[cursor]!
    if (/^\d{1,2}$/.test(word)) return Number(word)
    if (word in NUMBER_WORDS) {
      // "a pair of" and "a couple of" carry the count in the second word.
      if ((word === 'a' || word === 'an') && (words[cursor + 1] === 'couple')) return 2
      if (word === 'pair') {
        const count = words[cursor - 1]
        return count && (/^\d{1,2}$/.test(count) ? Number(count) : NUMBER_WORDS[count]) || 1
      }
      return NUMBER_WORDS[word]
    }
    if (!FILLER_WORDS.has(word)) return undefined
  }
  return undefined
}

export function parseItems(prompt: string): ParsedBrief['items'] {
  const words = normalizeText(prompt).split(' ')
  const items: ParsedBrief['items'] = []
  for (let index = 0; index < words.length;) {
    let matched: { phrase: string; entry: LexiconEntry; length: number } | undefined
    for (let length = MAX_PHRASE_WORDS; length >= 1 && !matched; length -= 1) {
      const phrase = words.slice(index, index + length).join(' ')
      const found = LEXICON[phrase]
      if (found) matched = { phrase, entry: found, length }
    }
    if (!matched) {
      index += 1
      continue
    }
    const quantity = quantityBefore(words, index)
    const modifiers = modifiersBefore(words, index)
    const noun = matched.entry.hint ?? (matched.entry.group === 'category' ? matched.phrase : undefined)
    const hint = noun && modifiers.length ? `${modifiers.join(' ')} ${noun}` : matched.entry.hint
    const existing = items.find(item => item.phrase === matched!.phrase)
    if (existing) existing.quantity = Math.min(20, existing.quantity + (quantity ?? 1))
    else {
      items.push({
        phrase: matched.phrase,
        quantity: Math.min(20, quantity ?? 1),
        categories: [...matched.entry.categories],
        group: matched.entry.group,
        hint,
        explicitQuantity: quantity !== undefined,
      })
    }
    index += matched.length
  }
  return items
}

function cueNear(text: string, start: number, end: number, cues: readonly string[]): boolean {
  const before = text.slice(Math.max(0, start - 28), start)
  const after = text.slice(end, end + 16)
  return cues.some(cue => new RegExp(`\\b${cue}\\b`).test(before) || new RegExp(`^\\s*(?:cad\\s*)?\\b${cue}\\b`).test(after))
}

/**
 * Finds the first CAD amount and decides whether it caps the whole basket or each item. "Budget", "total" and
 * "spend" mean the basket; "each", "per item" and "under" mean one item. Without a cue, a multi-item brief
 * reads as a basket budget.
 */
export function parseBudget(prompt: string, totalQuantity: number): ParsedBrief['budget'] {
  const text = normalizeText(prompt)
  const pattern = /(?:cad\s*)?\$\s*(\d+(?:\.\d+)?)(?:\s*cad)?|\b(\d+(?:\.\d+)?)\s*(?:cad|dollars|bucks)\b|\bcad\s*(\d+(?:\.\d+)?)/g
  const matches = [...text.matchAll(pattern)]
  // A local item cap can precede the basket budget. Prefer an explicitly total amount anywhere in the brief.
  const match = matches.find(match => cueNear(text, match.index!, match.index! + match[0].length, TOTAL_CUES)) ?? matches[0]
  if (!match) return undefined
  const amountCad = Number(match[1] ?? match[2] ?? match[3])
  if (!Number.isFinite(amountCad) || amountCad <= 0) return undefined
  const start = match.index
  const end = start + match[0].length
  let scope: BudgetScope
  if (cueNear(text, start, end, TOTAL_CUES)) scope = 'total'
  else if (cueNear(text, start, end, EACH_CUES)) scope = 'each'
  else scope = totalQuantity > 1 ? 'total' : 'each'
  return { amountCad, scope }
}

export function parseDestination(prompt: string): { destination?: string; climate?: Climate } {
  const text = ` ${normalizeText(prompt)} `
  const place = Object.keys(DESTINATIONS)
    .toSorted((left, right) => right.length - left.length)
    .find(name => text.includes(` ${name} `))
  if (place) return { destination: titleCase(place), climate: DESTINATIONS[place] }
  const climate = (Object.entries(CLIMATE_WORDS) as Array<[Climate, string[]]>)
    .find(([, words]) => words.some(word => text.includes(` ${word} `)))?.[0]
  return { climate }
}

export function parseBrief(prompt: string): ParsedBrief {
  const items = parseItems(prompt)
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    items,
    budget: parseBudget(prompt, totalQuantity),
    ...parseDestination(prompt),
  }
}

/** Which apparel categories "clothes" covers for this trip and department. */
export function clothesCategories(climate: Climate | undefined, department: ShoppingDepartment): ProductCategory[] {
  const base: ProductCategory[] = department === 'men' ? ['tops', 'bottoms'] : ['tops', 'bottoms', 'dresses']
  if (climate === 'hot') return [...base, 'swimwear']
  if (climate === 'cold') return [...base, 'outerwear']
  return base
}

type Bank = Record<Climate, Partial<Record<ShoppingDepartment, string[]>> & { all: string[] }>

// Ordered so the first three queries (the ones Shop runs) already cover different slots.
const QUERY_BANK: Partial<Record<ProductCategory | 'clothes', Bank>> = {
  clothes: {
    hot: {
      women: ['linen shirt', 'sundress', 'swimsuit', 'linen shorts', 'linen pants', 'crochet top'],
      men: ['linen shirt', 'swim trunks', 'linen shorts', 'camp collar shirt', 'linen pants', 'knit polo'],
      all: ['linen shirt', 'linen shorts', 'swimwear', 'sundress', 'linen pants', 'camp collar shirt'],
    },
    cold: {
      women: ['wool sweater', 'puffer jacket', 'thermal leggings', 'knit dress', 'wool trousers'],
      men: ['wool sweater', 'puffer jacket', 'thermal base layer', 'wool trousers', 'flannel shirt'],
      all: ['wool sweater', 'puffer jacket', 'thermal base layer', 'wool trousers'],
    },
    mild: {
      women: ['button up shirt', 'wide leg trousers', 'midi dress', 'knit top', 'denim jeans'],
      men: ['oxford shirt', 'chinos', 'knit polo', 'denim jeans', 'overshirt'],
      all: ['button up shirt', 'chinos', 'knit top', 'denim jeans'],
    },
  },
  footwear: {
    hot: { women: ['flat sandals', 'espadrilles', 'slides'], men: ['leather sandals', 'espadrilles', 'canvas sneakers'], all: ['sandals', 'espadrilles', 'slides'] },
    cold: { women: ['winter boots', 'chelsea boots', 'sneakers'], men: ['winter boots', 'chelsea boots', 'sneakers'], all: ['winter boots', 'chelsea boots', 'sneakers'] },
    mild: { women: ['white sneakers', 'loafers', 'ankle boots'], men: ['white sneakers', 'loafers', 'chelsea boots'], all: ['white sneakers', 'loafers', 'ankle boots'] },
  },
  fragrance: {
    hot: { women: ['citrus eau de parfum', 'floral perfume', 'fresh fragrance'], men: ['citrus cologne', 'fresh eau de toilette', 'aquatic fragrance'], all: ['unisex citrus fragrance', 'fresh eau de parfum'] },
    cold: { women: ['vanilla perfume', 'amber eau de parfum', 'warm fragrance'], men: ['woody cologne', 'amber eau de toilette', 'warm fragrance'], all: ['woody unisex fragrance', 'amber eau de parfum'] },
    mild: { women: ['eau de parfum', 'floral perfume', 'signature fragrance'], men: ['eau de toilette', 'cologne', 'signature fragrance'], all: ['unisex fragrance', 'eau de parfum'] },
  },
  swimwear: {
    hot: { women: ['swimsuit', 'bikini', 'one piece swimsuit'], men: ['swim trunks', 'swim shorts'], all: ['swimwear', 'swim shorts'] },
    cold: { all: ['swimwear'] },
    mild: { all: ['swimwear'] },
  },
}

/** Concrete searches for one brief item: the person's own noun first, then climate-appropriate staples. */
export function queriesForItem(
  item: Pick<ParsedBrief['items'][number], 'phrase' | 'group' | 'categories' | 'hint'>,
  climate: Climate | undefined,
  department: ShoppingDepartment,
  dinner = false,
): string[] {
  const key = item.group === 'clothes' ? 'clothes' : item.categories[0]
  if (dinner) {
    if (key === 'footwear' && !item.hint) return ['loafers', 'leather sneakers', 'dress shoes']
    if (key === 'tops' && (!item.hint || ['shirt', 'top'].includes(item.hint))) return ['button up shirt', 'oxford shirt', 'knit polo']
    if (key === 'bottoms' && (!item.hint || ['pants', 'trousers'].includes(item.hint))) return ['tailored trousers', 'chinos']
    if (key === 'fragrance' && !item.hint) return ['eau de parfum', 'cologne', 'perfume']
  }
  const bank = key ? QUERY_BANK[key] : undefined
  const staples = bank ? (bank[climate ?? 'mild'][department] ?? bank[climate ?? 'mild'].all) : []
  // Generic nouns ("footwears", "perfume") are not useful searches when climate-aware staples exist.
  const own = item.hint ?? (item.group === 'clothes' || staples.length ? undefined : item.phrase)
  return [...new Set([own, ...staples].filter((query): query is string => Boolean(query)))].slice(0, 6)
}
