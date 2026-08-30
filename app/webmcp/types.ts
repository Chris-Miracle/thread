export interface JSONSchemaNode {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  description?: string
  enum?: readonly string[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  properties?: Record<string, JSONSchemaNode>
  required?: readonly string[]
  items?: JSONSchemaNode
  additionalProperties?: boolean
}

export interface WebMCPToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: JSONSchemaNode
  annotations: {
    readOnlyHint: boolean
    untrustedContentHint?: boolean
  }
  execute(input: Record<string, unknown>, options?: { signal: AbortSignal }): Promise<unknown> | unknown
}
