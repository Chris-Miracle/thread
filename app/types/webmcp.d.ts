type ThreadJSONSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  description?: string
  properties?: Record<string, ThreadJSONSchema>
  items?: ThreadJSONSchema
  required?: readonly string[]
  enum?: readonly string[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  additionalProperties?: boolean
}

type ThreadWebMCPTool = {
  name: string
  title?: string
  description: string
  inputSchema?: ThreadJSONSchema
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute: (input: Record<string, unknown>, options?: { signal: AbortSignal }) => Promise<unknown> | unknown
}

type ThreadRegisteredTool = {
  name: string
  title?: string
  description: string
  inputSchema?: string
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
}

interface ThreadModelContext extends EventTarget {
  registerTool(tool: ThreadWebMCPTool, options?: { signal?: AbortSignal }): Promise<void>
  getTools?(options?: { fromOrigins?: string[] }): Promise<ThreadRegisteredTool[]>
  executeTool?(tool: ThreadRegisteredTool, input?: string, options?: { signal?: AbortSignal }): Promise<unknown>
}

declare global {
  interface Document {
    readonly modelContext?: ThreadModelContext
  }
}

export {}
