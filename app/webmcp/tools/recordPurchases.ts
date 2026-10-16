import type { createThreadActions } from '~/domain/threadActions'
import { optionalString, requiredArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function recordPurchasesTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'record_purchases',
    title: 'Record confirmed purchases',
    description: 'Tell Rove what the user bought so it stops recommending owned items and learns favourite brands. Use source "checkout" only after Shop returns status completed with an order; Rove then marks that seller’s handoff as Ordered. Use "order-history" for items from Shop search_orders. Send only seller domain, product link, brand, and order link: never addresses, emails, payment details, or prices.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['checkout', 'order-history'] },
        purchases: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              sellerDomain: { type: 'string', description: 'Shop seller.domain; required for checkout.' },
              productUrl: { type: 'string' },
              brand: { type: 'string' },
              orderPermalink: { type: 'string', description: 'Returned permalink_url, unchanged, when present.' },
            },
            additionalProperties: false,
          },
        },
      },
      required: ['source', 'purchases'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const source = requiredString(input, 'source')
      if (source !== 'checkout' && source !== 'order-history') throw new Error('source must be checkout or order-history.')
      return actions.recordPurchases({
        source,
        purchases: requiredArray(input, 'purchases').map((value, index) => {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`purchases[${index}] must be an object.`)
          const purchase = value as Record<string, unknown>
          return {
            sellerDomain: optionalString(purchase, 'sellerDomain'),
            productUrl: optionalString(purchase, 'productUrl'),
            brand: optionalString(purchase, 'brand'),
            orderPermalink: optionalString(purchase, 'orderPermalink'),
          }
        }),
      })
    },
  }
}
