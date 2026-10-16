---
name: rove-shop
description: Use Rove's built-in anonymous Shop catalogue connection, preserve exact product evidence, and fall back to official retailers.
---

# Shop in Rove

Read [Shop's official skill](https://shop.com/skill.md) and its selected binding guidance before research. Rove is a client of the read-only Shop HTTP API at https://mcp.shop.com/. It performs protocol discovery and checks that search_catalog and get_product are advertised as read-only before calling them. It sends no account credentials, cookies, identity, street address or payment information. Search sends the planned query, coarse delivery country/region, CAD currency, preferences and hard filters. Reference-image searches transmit the supplied image only when requested by the person.

## Default discovery path

1. Read get_profile and start_shopping_search with the person's original words. Confirm the returned needs, quantities, budgets, department and store restrictions. Refine needs when necessary. Per-need store arrays restrict only that item; an empty array keeps it open. Rove uses CAD for budgeting regardless of the visitor's country; set the profile's delivery country/region from the person's stated destination. Do not assume Canada for a visitor who has specified another country.
2. Resolve unfamiliar storeNames to verified official domains before claiming targets. Resolving an unfamiliar store must retain registered stores and each need's assignment.
3. Claim targets. For every catalogue target call Rove search_shop_catalog with searchId, targetId and each requestIndex. No installation or sign-in is required. It sends the planned arguments unchanged. Do not declare Shop disconnected because your agent has no Shop tool.
4. Inspect result.structuredContent (or returned content) and every message. A successful empty search is no matching offers. A status:failed result contains the actual error code, message and retryability. Retry a retryable read at most once. A 401 requires optional account setup through an official agent binding; do not collect a Shop token in Rove. A 403 is policy, not a sign-in request.
5. Publish only relevant returned products, with their complete featured variant URL, image, product/variant/seller IDs, exact option name/label pairs, availability and integer-minor-unit price. Keep native currency; do not invent CAD conversions. Named-store filters may produce no offers: never replace them with other merchants without the person's choice.
6. For unresolved product options call inspect_shop_product with the published Rove product ID and exact requestedOptions. Compare the effective returned options, stock and price, then enrich_product. Independent size/colour lists never establish a purchasable combination.
7. Resolve the target as complete after accepted publication, no-results for no matching offers, or failed with the actual error. Follow retailer targets when needs remain unmet: use official search pages and region selectors, inspect canonical product pages, publish direct product images and observed prices, enrich and resolve. Retailer WebMCP may help when exposed. CAPTCHA, unavailable stock, unsupported shipping and merchant restrictions remain explicit blockers.
8. Present a coordinated basket, prices, links and material unknowns. Adding to Your Thread, merchant checkout and payment are distinct actions; research never authorizes a purchase.

## Compatibility

Rove is a static browser app. Built-in Shop search runs in the visitor's browser using the endpoint's CORS support; it needs Internet access and a compatible WebMCP agent that can invoke Rove tools. It does not need the developer's machine or localhost. Ordinary browsers without WebMCP cannot execute a conversational shopping mission. Agent hosts may supply an official Shop CLI/MCP/HTTP binding instead. Follow Shop's current skill to set that up; setup is not complete until a real catalogue request succeeds. Merchant coverage, service availability, currencies, duties and delivery are external facts, never guarantees.

For checkout, account history or saved payment details, use an official agent Shop binding and the current transactions guide. Rove's built-in transport deliberately exposes only search_catalog and get_product. It cannot create carts, sign in, place orders or pay.
