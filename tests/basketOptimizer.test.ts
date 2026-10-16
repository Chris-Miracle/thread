import { describe, expect, it } from 'vitest'
import { evaluateMissionFulfillment } from '../app/domain/research/fulfillment'
import { createSearchMission } from '../app/domain/search/mission'
import type { Product, ProductCategory } from '../app/types/thread'
import { extractPalette, nearestColourName, rgbToLab } from '../app/utils/imagePalette'
import { DEFAULT_PROFILE } from './helpers'

const mission = createSearchMission({ rawPrompt: 'three clothes and a perfume, two footwears, budget of $450 CAD for Cancun' }, DEFAULT_PROFILE, '2026-10-13T12:00:00.000Z')
const [clothes, perfume, footwear] = mission.needs

let sequence = 0
function product(name: string, category: ProductCategory, priceCad: number, relevanceScore: number, needId: string, extra: Partial<Product> = {}): Product {
  sequence += 1
  return {
    id: `product:test:${sequence}`, searchId: 's', targetId: 't', needIds: [needId], name, retailer: `Store ${sequence}`, retailerId: `retailer:${sequence}`,
    retailerLogo: '', category, priceCad, nativePrice: priceCad, nativeCurrency: 'CAD', image: 'https://cdn.example.test/a.jpg', url: `https://store${sequence}.test/products/${sequence}`,
    colors: [], sizes: [], styleTags: [], occasionTags: [], source: 'agent', stage: 'candidate', availability: 'in-stock',
    observedAt: '2026-10-13T12:00:00.000Z', relevanceScore, ...extra,
  }
}

function basketOf(products: Product[]) {
  const result = evaluateMissionFulfillment(mission, products)
  const chosen = products.filter(item => result.selectedProductIds.includes(item.id))
  return { result, chosen, names: chosen.map(item => item.name).sort() }
}

const strongBasket = [
  product('Riviera linen shirt', 'tops', 55, 60, clothes!.id),
  product('Coastal sundress', 'dresses', 70, 58, clothes!.id),
  product('Lagoon swimsuit', 'swimwear', 50, 56, clothes!.id),
  product('Breeze linen shorts', 'bottoms', 40, 40, clothes!.id),
  product('Budget tee', 'tops', 12, 10, clothes!.id),
  product('Neroli eau de parfum', 'fragrance', 110, 55, perfume!.id),
  product('Mini body mist', 'fragrance', 25, 15, perfume!.id),
  product('Cedar cologne', 'fragrance', 140, 50, perfume!.id),
  product('Leather flat sandals', 'footwear', 80, 57, footwear!.id),
  product('Jute espadrilles', 'footwear', 65, 54, footwear!.id),
  product('Foam slides', 'footwear', 20, 12, footwear!.id),
  product('Woven slides', 'footwear', 45, 30, footwear!.id),
]

describe('basket optimizer', () => {
  it('fills every quantity within the overall budget, preferring relevance over the cheapest items', () => {
    const { result, chosen, names } = basketOf(strongBasket)
    expect(result.satisfied).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.subtotalCad).toBeLessThanOrEqual(450)
    expect(chosen.filter(item => item.category === 'fragrance')).toHaveLength(1)
    expect(chosen.filter(item => item.category === 'footwear')).toHaveLength(2)
    expect(names).toEqual(expect.arrayContaining(['Riviera linen shirt', 'Coastal sundress', 'Lagoon swimsuit', 'Neroli eau de parfum', 'Leather flat sandals', 'Jute espadrilles']))
    expect(names).not.toContain('Budget tee')
  })

  it('trades relevance for budget when the best items do not fit together', () => {
    const tight = createSearchMission({ rawPrompt: 'two clothes and a perfume, budget of $150 CAD' }, DEFAULT_PROFILE)
    const items = [
      product('Silk midi dress', 'dresses', 120, 70, tight.needs[0]!.id),
      product('Linen shirt', 'tops', 45, 50, tight.needs[0]!.id),
      product('Cotton shorts', 'bottoms', 35, 45, tight.needs[0]!.id),
      product('Signature parfum', 'fragrance', 95, 65, tight.needs[1]!.id),
      product('Citrus cologne', 'fragrance', 55, 48, tight.needs[1]!.id),
    ]
    const result = evaluateMissionFulfillment(tight, items)
    expect(result.satisfied).toBe(true)
    expect(result.subtotalCad).toBe(135)
    expect(items.filter(item => result.selectedProductIds.includes(item.id)).map(item => item.name).sort())
      .toEqual(['Citrus cologne', 'Cotton shorts', 'Linen shirt'])
  })

  it('reports an unsatisfied basket, with best partial picks, when nothing fits the budget', () => {
    const { result } = basketOf([
      product('Couture dress', 'dresses', 400, 60, clothes!.id),
      product('Couture blouse', 'tops', 300, 60, clothes!.id),
      product('Couture skirt', 'bottoms', 300, 60, clothes!.id),
      product('Rare parfum', 'fragrance', 300, 60, perfume!.id),
      product('Designer sandals', 'footwear', 300, 60, footwear!.id),
      product('Designer mules', 'footwear', 300, 60, footwear!.id),
    ])
    expect(result.satisfied).toBe(false)
    expect(result.ready).toBe(false)
    expect(result.needs.every(need => need.selectedProductIds.length > 0)).toBe(true)
  })

  it('assembles an outfit instead of three versions of the same piece', () => {
    const { names } = basketOf([
      product('Classic white linen shirt', 'tops', 50, 60, clothes!.id),
      product('Classic white linen shirt relaxed', 'tops', 50, 59, clothes!.id),
      product('Classic white linen shirt cropped', 'tops', 50, 58, clothes!.id),
      product('Tiered sundress', 'dresses', 60, 52, clothes!.id),
      product('Ribbed swimsuit', 'swimwear', 45, 50, clothes!.id),
      ...strongBasket.slice(5),
    ])
    expect(names.filter(name => name.startsWith('Classic white linen shirt'))).toHaveLength(1)
    expect(names).toEqual(expect.arrayContaining(['Tiered sundress', 'Ribbed swimsuit']))
  })

  it('never selects unpriced or out-of-stock items, and needs real alternatives before research may stop', () => {
    const items = [
      product('Sold-out sandals', 'footwear', 60, 90, footwear!.id, { availability: 'out-of-stock' }),
      product('Unpriced sandals', 'footwear', 60, 90, footwear!.id, { priceCad: undefined }),
      ...strongBasket.slice(0, 3),
      strongBasket[5]!,
      strongBasket[8]!,
      strongBasket[9]!,
    ]
    const { result, names } = basketOf(items)
    expect(names).not.toContain('Sold-out sandals')
    expect(names).not.toContain('Unpriced sandals')
    expect(result.satisfied).toBe(true)
    expect(result.ready).toBe(false)
  })
})

describe('dressy occasion baskets', () => {
  const brief = 'ALDO shoes under $200, any perfume, a Zara coat and a shirt'
  function occasionBasket(rawPrompt: string) {
    const occasion = createSearchMission({ rawPrompt }, DEFAULT_PROFILE, '2026-10-13T12:00:00.000Z')
    const [shoes, scent, coat, shirt] = occasion.needs
    // The cheapest option in every need is marginally more relevant, which used to decide the basket.
    const items = [
      product('Faux leather loafers', 'footwear', 55, 52, shoes!.id),
      product('Leather block-heel pumps', 'footwear', 170, 50, shoes!.id),
      product('Generic vanilla perfume', 'fragrance', 25, 52, scent!.id),
      product('Valentino Born in Roma eau de parfum', 'fragrance', 150, 50, scent!.id, { brand: 'Valentino' }),
      product('Basic trench coat', 'outerwear', 79, 52, coat!.id),
      product('Wool blend tailored coat', 'outerwear', 199, 50, coat!.id),
      product('Basic poplin shirt', 'tops', 29, 52, shirt!.id),
      product('Satin shirt', 'tops', 69, 50, shirt!.id),
    ]
    const result = evaluateMissionFulfillment(occasion, items)
    return { occasion, result, names: items.filter(item => result.selectedProductIds.includes(item.id)).map(item => item.name).sort() }
  }

  it('uses the budget for an engagement dinner instead of picking the cheapest piece in every need', () => {
    const { occasion, result, names } = occasionBasket(`${brief} for an engagement dinner, overall budget $650 CAD`)
    expect(occasion.context.occasions).toEqual(expect.arrayContaining(['dinner', 'formal']))
    expect(result.satisfied).toBe(true)
    expect(names).toEqual(['Leather block-heel pumps', 'Satin shirt', 'Valentino Born in Roma eau de parfum', 'Wool blend tailored coat'])
    expect(result.subtotalCad).toBe(588)
    expect(result.subtotalCad).toBeLessThanOrEqual(650)
  })

  it('keeps preferring value for everyday missions', () => {
    const { occasion, result, names } = occasionBasket(`${brief}, overall budget $650 CAD`)
    expect(occasion.context.occasions).toEqual([])
    expect(result.satisfied).toBe(true)
    expect(names).toEqual(['Basic poplin shirt', 'Basic trench coat', 'Faux leather loafers', 'Generic vanilla perfume'])
  })
})

describe('reference image palette', () => {
  function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]) {
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b] = paint(x, y)
        pixels.set([r, g, b, 255], (y * width + x) * 4)
      }
    }
    return pixels
  }

  it('names colours perceptually', () => {
    expect(nearestColourName(rgbToLab([28, 38, 78]))).toBe('navy')
    expect(nearestColourName(rgbToLab([196, 150, 108]))).toBe('tan')
    expect(nearestColourName(rgbToLab([250, 250, 250]))).toBe('white')
  })

  it('finds the garment colours and ignores a studio backdrop', () => {
    const pixels = image(120, 160, (x, y) => {
      const inside = x > 24 && x < 96 && y > 20 && y < 140
      if (!inside) return [248, 248, 246]
      return y < 100 ? [28, 40, 82] : [196, 152, 108]
    })
    expect(extractPalette(pixels, 120, 160)).toEqual(['navy', 'tan'])
  })
})
