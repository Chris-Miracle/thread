import type { createThreadActions } from '~/domain/threadActions'
import { optionalRecord, optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function attachMerchantCartTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'attach_merchant_cart',
    title: 'Attach a Shop cart to a seller group',
    description: 'After creating a Shop cart or checkout for one get_checkout_plan seller group, store its continue_url unchanged so the human can continue to that merchant. Include the merchant-returned total and every warning or disclosure message. This records a handoff only; it does not place an order.',
    inputSchema: {
      type: 'object',
      properties: {
        groupKey: { type: 'string', description: 'Exact key of a Shop-backed group from get_checkout_plan.' },
        continueUrl: { type: 'string', description: 'The complete continue_url returned by Shop, unchanged.' },
        cartId: { type: 'string' },
        total: {
          type: 'object',
          description: 'Merchant-returned total in integer minor units.',
          properties: { amount: { type: 'number', minimum: 0 }, currency: { type: 'string' } },
          required: ['amount', 'currency'],
          additionalProperties: false,
        },
        messages: { type: 'array', items: { type: 'string' }, description: 'Every returned warning and disclosure, verbatim.' },
      },
      required: ['groupKey', 'continueUrl'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const total = optionalRecord(input, 'total')
      return actions.attachMerchantCart({
        groupKey: requiredString(input, 'groupKey'),
        continueUrl: requiredString(input, 'continueUrl'),
        cartId: optionalString(input, 'cartId'),
        total: total ? { amount: total.amount as number, currency: requiredString(total, 'currency') } : undefined,
        messages: optionalStringArray(input, 'messages'),
      })
    },
  }
}
