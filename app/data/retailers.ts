import type { Retailer, ShoppingGender } from '~/types/thread'

function logo(domain: string) {
  return `https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128`
}

function retailer(id: string, name: string, domain: string, searchUrl: string, departments: ShoppingGender[], tags: string[]): Retailer {
  return { id, name, domain, searchUrl, departments, tags, logo: logo(domain) }
}

export const RETAILERS: Retailer[] = [
  retailer('fashion-nova', 'Fashion Nova', 'fashionnova.com', 'https://www.fashionnova.com/en-ca/pages/search-results?q={query}', ['women', 'men'], ['trend', 'party', 'denim']),
  retailer('shein', 'SHEIN', 'ca.shein.com', 'https://ca.shein.com/pdsearch/{query}/', ['women', 'men'], ['value', 'trend', 'wide-selection']),
  retailer('oh-polly', 'Oh Polly', 'us.ohpolly.com', 'https://us.ohpolly.com/search?q={query}', ['women'], ['occasion', 'party', 'dresses']),
  retailer('gymshark', 'Gymshark', 'ca.gymshark.com', 'https://ca.gymshark.com/search?q={query}', ['women', 'men'], ['activewear', 'training']),
  retailer('zara', 'Zara', 'zara.com', 'https://www.zara.com/ca/en/search?searchTerm={query}', ['women', 'men'], ['editorial', 'trend']),
  retailer('hm', 'H&M', 'www2.hm.com', 'https://www2.hm.com/en_ca/search-results.html?q={query}', ['women', 'men'], ['value', 'basics']),
  retailer('uniqlo', 'UNIQLO', 'uniqlo.com', 'https://www.uniqlo.com/ca/en/search?q={query}', ['women', 'men', 'all'], ['minimal', 'basics']),
  retailer('cos', 'COS', 'cos.com', 'https://www.cos.com/en-ca/search?q={query}', ['women', 'men'], ['minimal', 'modern']),
  retailer('asos', 'ASOS', 'asos.com', 'https://www.asos.com/search/?q={query}', ['women', 'men'], ['wide-selection', 'trend']),
  retailer('aritzia', 'Aritzia', 'aritzia.com', 'https://www.aritzia.com/en/search?q={query}', ['women'], ['minimal', 'premium']),
  retailer('abercrombie', 'Abercrombie', 'abercrombie.com', 'https://www.abercrombie.com/shop/ca/search?searchTerm={query}', ['women', 'men'], ['casual', 'classic']),
  retailer('nike', 'Nike', 'nike.com', 'https://www.nike.com/ca/w?q={query}', ['women', 'men', 'all'], ['sport', 'footwear']),
  retailer('new-balance', 'New Balance', 'newbalance.ca', 'https://www.newbalance.ca/en_ca/search/?q={query}', ['women', 'men', 'all'], ['sport', 'footwear']),
  retailer('adidas', 'adidas', 'adidas.ca', 'https://www.adidas.ca/en/search?q={query}', ['women', 'men', 'all'], ['sport', 'streetwear']),
  retailer('mango', 'Mango', 'shop.mango.com', 'https://shop.mango.com/ca/en/search?kw={query}', ['women', 'men'], ['smart-casual', 'modern']),
  retailer('reformation', 'Reformation', 'thereformation.com', 'https://www.thereformation.com/search?q={query}', ['women'], ['occasion', 'premium']),
  retailer('meshki', 'MESHKI', 'meshki.com.au', 'https://www.meshki.com.au/search?q={query}', ['women'], ['occasion', 'party']),
  retailer('princess-polly', 'Princess Polly', 'princesspolly.com', 'https://us.princesspolly.com/search?q={query}', ['women'], ['trend', 'party']),
  retailer('dynamite', 'Dynamite', 'dynamiteclothing.com', 'https://www.dynamiteclothing.com/ca/search?q={query}', ['women'], ['smart-casual', 'trend']),
  retailer('garage', 'Garage', 'garageclothing.com', 'https://www.garageclothing.com/ca/search?q={query}', ['women'], ['casual', 'y2k']),
  retailer('lululemon', 'lululemon', 'shop.lululemon.com', 'https://shop.lululemon.com/search?Ntt={query}', ['women', 'men', 'all'], ['activewear', 'premium']),
  retailer('ssense', 'SSENSE', 'ssense.com', 'https://www.ssense.com/en-ca/search?q={query}', ['women', 'men'], ['designer', 'avant-garde']),
  retailer('simons', 'Simons', 'simons.ca', 'https://www.simons.ca/en/search--search?query={query}', ['women', 'men'], ['canadian', 'wide-selection']),
  retailer('oak-fort', 'OAK + FORT', 'oakandfort.com', 'https://oakandfort.com/search?q={query}', ['women', 'men', 'all'], ['minimal', 'modern']),
  retailer('frank-and-oak', 'Frank And Oak', 'frankandoak.com', 'https://www.frankandoak.com/search?q={query}', ['women', 'men'], ['canadian', 'minimal']),
  retailer('everlane', 'Everlane', 'everlane.com', 'https://www.everlane.com/search?q={query}', ['women', 'men'], ['minimal', 'basics']),
  retailer('good-american', 'Good American', 'goodamerican.com', 'https://www.goodamerican.com/search?q={query}', ['women'], ['denim', 'curve', 'trend']),
  retailer('farfetch', 'FARFETCH', 'farfetch.com', 'https://www.farfetch.com/ca/shopping/search/items.aspx?q={query}', ['women', 'men'], ['designer', 'marketplace']),
  retailer('shopbop', 'Shopbop', 'shopbop.com', 'https://www.shopbop.com/actions/search/searchResultsAction.action?query={query}', ['women'], ['designer', 'wide-selection']),
  retailer('revolve', 'REVOLVE', 'revolve.com', 'https://www.revolve.com/r/Search.jsp?search={query}', ['women', 'men'], ['trend', 'occasion', 'premium']),
  retailer('holt-renfrew', 'Holt Renfrew', 'holtrenfrew.com', 'https://www.holtrenfrew.com/en/search?q={query}', ['women', 'men'], ['canadian', 'designer']),
  retailer('saks', 'Saks Fifth Avenue', 'saksfifthavenue.com', 'https://www.saksfifthavenue.com/search?q={query}', ['women', 'men'], ['designer', 'premium']),
]

export const RETAILER_BY_ID = new Map(RETAILERS.map(item => [item.id, item]))

export function retailerForDomain(domain: string): Retailer | undefined {
  const normalized = domain.toLowerCase().replace(/^www\./, '')
  return RETAILERS.find(item => normalized === item.domain.replace(/^www\./, '') || normalized.endsWith(`.${item.domain.replace(/^www\./, '')}`))
}

export function retailerSearchUrl(retailer: Retailer, query: string): string {
  return retailer.searchUrl.replace('{query}', encodeURIComponent(query.trim()))
}
