import { RETAILER_BY_ID, retailerIdsMentionedIn } from '~/data/retailers'
import { parseItems, parseBudget } from '~/domain/search/briefParser'
import type { MissionNeed, SearchMission } from '~/types/thread'

export function storeDomain(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`)
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)
    || /(^|\.)(localhost|example\.com|google\.com|pinterest\.com)$/.test(host)) throw new Error('Use the verified official store domain, such as gymshark.com.')
  return host
}

/** Known retailers and explicit domains need no guesswork; unfamiliar names remain unresolved. */
export function promptStores(prompt: string): { domains: string[]; names: string[] } {
  const domains = [...prompt.matchAll(/\b(?:https:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s,]*)?/gi)]
    .map(match => storeDomain(match[0].replace(/[.!?]+$/, '')))
  const known = retailerIdsMentionedIn(prompt)
  // Store clauses end at shopping/budget/category language; never infer an official domain from a name.
  const clauses = [...prompt.matchAll(/\b(?:from|at|go to)\s+([A-Za-z][A-Za-z0-9&+'. -]*?)(?=\s+(?:get|find|buy|for|under|with|within|only|in|to|and (?:a|an|one|two|three)|shirt|shirts|pants|trousers|shoes|perfume|perfumes|belt|bracelet|coat)\b|[,;!?]|$)/gi)]
  const names = clauses.map(match => match[1]!.trim()).filter(name => name.length <= 80 && !name.includes('.')
    && !known.some(id => retailerIdsMentionedIn(name).includes(id))
    && !/^(?:dinner|night|home|work|least|most|all)$/i.test(name))
  return { domains: [...new Set(domains)], names: [...new Set(names)] }
}

export function registeredStoreDomains(ids: readonly string[]): string[] {
  return ids.flatMap(id => RETAILER_BY_ID.get(id)?.domains ?? [])
}

export function needStoreDomains(need: MissionNeed, mission: SearchMission): string[] {
  const scoped = need.retailerIds !== undefined || need.storeDomains !== undefined || need.storeNames !== undefined
  return [...new Set([...registeredStoreDomains(scoped ? need.retailerIds ?? [] : mission.constraints.retailerIds),
    ...(scoped ? need.storeDomains ?? [] : mission.constraints.storeDomains ?? [])])]
}

/** Clause-local restrictions keep "Aldo shoes, Zara coat and shirt, a perfume" from becoming one store filter. */
export function scopeBriefNeeds(prompt: string, needs: MissionNeed[]): MissionNeed[] {
  const clauses = prompt.split(/[,;!?]|\b(?:also|then|but)\b/i).map(text => ({ text, items: parseItems(text), stores: promptStores(text) }))
  const hasStores = clauses.some(clause => clause.items.length && (retailerIdsMentionedIn(clause.text).length || clause.stores.domains.length || clause.stores.names.length))
  const hasTotalBudget = clauses.some(clause => parseBudget(clause.text, 2)?.scope === 'total')
  return needs.map(need => {
    const matching = clauses.filter(clause => clause.items.some(item => item.phrase === need.intent || item.hint === need.intent))
    const retailerIds = [...new Set(matching.flatMap(clause => retailerIdsMentionedIn(clause.text)))]
    const storeDomains = [...new Set(matching.flatMap(clause => clause.stores.domains))]
    const storeNames = [...new Set(matching.flatMap(clause => clause.stores.names))]
    const budget = hasTotalBudget ? matching.flatMap(clause => {
      const amount = parseBudget(clause.text, 1)
      return clause.items.length === 1 && amount?.scope === 'each' ? [amount.amountCad] : []
    })[0] : undefined
    return { ...need, ...(hasStores ? { retailerIds, storeDomains, storeNames } : {}), ...(budget ? { budgetCad: budget } : {}) }
  })
}

export function matchesStore(url: string, domains: readonly string[]): boolean {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`))
}
