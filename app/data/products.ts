import { RETAILER_BY_ID } from '~/data/retailers'
import { canonicalizeProductUrl, productIdFromUrl } from '~/domain/productIdentity'
import type { Product } from '~/types/thread'

const OBSERVED_AT = '2026-08-27T12:00:00-04:00'

function verifiedProduct(input: Omit<Product, 'id' | 'retailer' | 'retailerLogo' | 'source' | 'observedAt' | 'url'> & { url: string }): Product {
  const retailer = RETAILER_BY_ID.get(input.retailerId)
  if (!retailer) throw new Error(`Unknown retailer: ${input.retailerId}`)
  const url = canonicalizeProductUrl(input.url)
  return {
    ...input,
    id: productIdFromUrl(url),
    url,
    retailer: retailer.name,
    retailerLogo: retailer.logo,
    source: 'curated',
    observedAt: OBSERVED_AT,
  }
}

export const PRODUCTS: Product[] = [
  verifiedProduct({
    name: 'Frankie Lace Trim Satin Mini Dress', brand: 'Fashion Nova', retailerId: 'fashion-nova', category: 'dresses', gender: 'women', price: 43, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/0293/9277/files/07-20-26_S2_6_26GWY50359G_Chartreuse_JG_RK_09-49-33_1724-FN_Helena-FN-HelenaBG_SG.jpg?crop=center&height=1200&v=1785516943&width=800',
    url: 'https://www.fashionnova.com/en-ca/products/frankie-lace-trim-satin-mini-dress?color=chartreuse',
    colors: ['Chartreuse'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL'], styleTags: ['y2k', 'smart-casual'], occasionTags: ['dinner', 'date-night', 'party'], availability: 'in-stock',
    description: 'A satin V-neck mini dress with adjustable straps, lace trim and a back zip.',
  }),
  verifiedProduct({
    name: 'Ruth Pinstripe Linen Midi Dress', brand: 'Fashion Nova', retailerId: 'fashion-nova', category: 'dresses', gender: 'women', price: 34, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/0293/9277/files/05-21-25_S6_8_MD9619C_Bluecombo_HY_IM_10-57-47_88992_PXF.jpg?crop=center&height=1200&v=1747951793&width=800',
    url: 'https://www.fashionnova.com/en-ca/products/ruth-pinstripe-linen-midi-dress?color=blue-combo',
    colors: ['Blue Combo'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', '1X', '2X', '3X'], styleTags: ['smart-casual', 'classic'], occasionTags: ['dinner', 'work', 'casual'], availability: 'in-stock',
    description: 'A pinstripe midi shirt dress with a collar, short sleeves, button front, tie waist and side slit.',
  }),
  verifiedProduct({
    name: 'Devon Boat Neck Maxi Dress', brand: 'Fashion Nova', retailerId: 'fashion-nova', category: 'dresses', gender: 'women', price: 50, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/0293/9277/files/XD52072_Olive_JR_V1.jpg?crop=center&height=1200&v=1786123657&width=800',
    url: 'https://www.fashionnova.com/en-ca/products/devon-boat-neck-maxi-dress?color=olive',
    colors: ['Olive'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL'], styleTags: ['minimal', 'smart-casual'], occasionTags: ['dinner', 'date-night', 'formal'], availability: 'in-stock',
    description: 'A lined, stretch maxi dress with a boat neckline, short sleeves and button detail.',
  }),
  verifiedProduct({
    name: 'SHEIN BASICS Cropped Sweater Cardigan', brand: 'SHEIN BASICS', retailerId: 'shein', category: 'tops', gender: 'women', price: 20.64, currency: 'CAD',
    image: 'https://img.ltwebstatic.com/v4/j/pi/2025/09/29/95/1759148966f0711e1d45a9ec52901ab3c7c5dc6849_thumbnail_220x293.webp',
    url: 'https://ca.shein.com/SHEIN-BASICS-Casual-Basic-Solid-Color-Round-Neck-Long-Sleeve-Loose-Cropped-Women-Sweater-Cardigan-Women-Autumn-Coat-Everyday-Business-Office-Dark-Brown-p-200707968.html',
    colors: ['Coffee Brown'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], styleTags: ['minimal', 'smart-casual'], occasionTags: ['casual', 'work', 'dinner'], availability: 'in-stock',
    description: 'A plain round-neck cardigan with long sleeves, a button front and a regular fit.',
  }),
  verifiedProduct({
    name: 'Striped Long Sleeve Casual Blouse', brand: 'SHEIN', retailerId: 'shein', category: 'tops', gender: 'women', price: 11.79, currency: 'CAD',
    image: 'https://img.ltwebstatic.com/v4/j/spmp/2025/12/11/f7/176544345627515308a59dfc3af916ebe504b046a2_thumbnail_220x293.webp',
    url: 'https://ca.shein.com/Women-s-Striped-Long-Sleeve-Casual-Blouse-Natural-Versatile-Textured-Relaxed-Elegant-Artistic-Unique-Daily-Outdoor-Striped-Spring-Brown-p-339705578.html',
    colors: ['Brown'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], styleTags: ['classic', 'smart-casual'], occasionTags: ['casual', 'work', 'weekend'], availability: 'in-stock',
    description: 'A brown striped long-sleeve blouse in a slightly stretchy knitted fabric.',
  }),
  verifiedProduct({
    name: 'Minimalist Notch-Neck Cap-Sleeve Top', brand: 'SHEIN', retailerId: 'shein', category: 'tops', gender: 'women', price: 11.40, currency: 'CAD',
    image: 'https://img.ltwebstatic.com/v4/j/pi/2026/04/17/87/1776414007debf623f5d3cb075d394417ff549b719_thumbnail_220x293.webp',
    url: 'https://ca.shein.com/SHEIN-Women-s-Casual-Everyday-Commute-Minimalist-Solid-Color-Notch-Neck-Cap-Sleeve-Top-Summer-p-445976009.html',
    colors: ['Navy Blue', 'Khaki', 'Royal Blue'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], styleTags: ['minimal', 'smart-casual'], occasionTags: ['work', 'casual', 'dinner'], availability: 'in-stock',
    description: 'A minimalist woven top with a notched neckline, cap sleeves and a regular fit.',
  }),
  verifiedProduct({
    name: 'SHEIN Frenchy Casual Striped Pants', brand: 'SHEIN Frenchy', retailerId: 'shein', category: 'bottoms', gender: 'women', price: 11.98, currency: 'CAD',
    image: 'https://img.ltwebstatic.com/v4/j/pi/2026/07/31/5b/1785491666f2b60bf6c0d717125771469404349106_thumbnail_220x293.webp',
    url: 'https://ca.shein.com/SHEIN-Frenchy-Women-s-Casual-Striped-Pants-Women-s-Casual-Clothing-Women-s-Summer-Wear-p-448883087.html',
    colors: ['Multicolor'], sizes: ['XS', 'S', 'M', 'L', 'XL'], styleTags: ['classic', 'smart-casual'], occasionTags: ['casual', 'travel', 'weekend'], availability: 'in-stock',
    description: 'Loose wide-leg trousers in a striped woven fabric with an elastic waist.',
  }),
  verifiedProduct({
    name: 'Everyday Seamless Leggings', brand: 'Gymshark', retailerId: 'gymshark', category: 'activewear', gender: 'women', price: 50, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/2446/8477/files/EverydaySeamlessLeggingsGSHeavyBlueB7A3L_UCTN_3370_3840x.jpg?v=1784725557',
    url: 'https://ca.gymshark.com/products/gymshark-everyday-seamless-leggings-leggings-blue-aw26-b7a3l-uctn',
    colors: ['Heavy Blue'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], styleTags: ['sporty', 'minimal'], occasionTags: ['training', 'casual', 'weekend'], availability: 'in-stock',
    description: 'High-waisted leggings made from a soft, lightweight seamless fabric for lifting and studio training.',
  }),
  verifiedProduct({
    name: 'Everyday Seamless Graphic Short Sleeve Top', brand: 'Gymshark', retailerId: 'gymshark', category: 'activewear', gender: 'women', price: 38, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/2446/8477/files/images-GFXAthleticEverydaySeamlessSSTop_FebStory2GoodLevelGSBlackB6B4A_BB2J_0006_3840x.jpg?v=1776346250',
    url: 'https://ca.gymshark.com/products/gymshark-everyday-seamless-graphic-short-sleeve-top-ss-tops-black-ss26',
    colors: ['Black'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], styleTags: ['sporty', 'streetwear'], occasionTags: ['training', 'casual', 'weekend'], availability: 'limited',
    description: 'A body-fit seamless crew-neck tee with subtle contouring and a chest graphic.',
  }),
  verifiedProduct({
    name: 'Cotton Shirt', brand: 'UNIQLO', retailerId: 'uniqlo', category: 'tops', gender: 'women', price: 49.90, currency: 'CAD',
    image: 'https://image.uniqlo.com/UQ/ST3/ca/imagesgoods/480074/item/cagoods_01_480074_3x4.jpg?width=900',
    url: 'https://www.uniqlo.com/ca/en/products/E480074-000/00',
    colors: ['Off White', 'Black', 'Blue'], sizes: ['XS', 'S', 'M', 'L', 'XL'], styleTags: ['minimal', 'classic', 'smart-casual'], occasionTags: ['work', 'casual', 'dinner'], availability: 'in-stock',
    description: 'A relaxed cotton poplin shirt with loose sleeves, a sharp collar and button closure.',
  }),
  verifiedProduct({
    name: 'Cash Only Striped Button Up Shirt', brand: 'Fashion Nova Men', retailerId: 'fashion-nova', category: 'tops', gender: 'men', price: 17, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/0293/9277/files/03-17-26_S7PM_32_RCS6FM640FN_Black_ZSR_KP_DJ_19-00-25_32898_SKS_CM.jpg?crop=center&height=1200&v=1774036799&width=800',
    url: 'https://www.fashionnova.com/en-ca/products/cash-only-striped-button-up-shirt?color=black',
    colors: ['Black', 'White'], sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'], styleTags: ['streetwear', 'y2k'], occasionTags: ['casual', 'weekend', 'party'], availability: 'in-stock',
    description: 'A short-sleeve striped button-up with chest pockets, a fold-down collar and graphic detail.',
  }),
  verifiedProduct({
    name: 'Shadow Seamless T Shirt', brand: 'Gymshark', retailerId: 'gymshark', category: 'activewear', gender: 'men', price: 58, currency: 'CAD',
    image: 'https://cdn.shopify.com/s/files/1/2446/8477/files/images-ShadowSeamlessTShirtGSBlackA1B2A_BB2J_1091_3840x.jpg?v=1746637425',
    url: 'https://ca.gymshark.com/products/gymshark-shadow-seamless-t-shirt-black-aw24',
    colors: ['Black'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'], styleTags: ['sporty', 'minimal'], occasionTags: ['training', 'casual'], availability: 'limited',
    description: 'A heavyweight, muscle-fit seamless tee designed for lifting.',
  }),
  verifiedProduct({
    name: 'AIRism Cotton Oversized T-Shirt', brand: 'UNIQLO U', retailerId: 'uniqlo', category: 'tops', gender: 'all', price: 24.90, currency: 'CAD',
    image: 'https://image.uniqlo.com/UQ/ST3/ca/imagesgoods/465185/item/cagoods_00_465185_3x4.jpg?width=900',
    url: 'https://www.uniqlo.com/ca/en/products/E465185-000/00',
    colors: ['White', 'Light Gray', 'Gray', 'Black', 'Red', 'Wine', 'Dark Brown', 'Yellow', 'Light Green', 'Dark Green', 'Blue', 'Navy', 'Light Purple'], sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], styleTags: ['minimal', 'streetwear', 'sporty'], occasionTags: ['casual', 'weekend', 'travel'], availability: 'in-stock',
    description: 'A genderless oversized half-sleeve tee with smooth AIRism fabric, dropped shoulders and a wide fit.',
  }),
]
