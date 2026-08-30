import { THREAD_TOOL_NAMES, registerThreadTools, unregisterThreadTools } from '~/webmcp/registerThreadTools'

export default defineNuxtPlugin({
  name: 'thread-webmcp',
  dependsOn: ['thread-state'],
  async setup() {
    const { status } = useWebMCPStatus()
    status.value.supported = Boolean(document.modelContext)
    if (!document.modelContext) return

    try {
      const toolNames = await registerThreadTools(useThreadActions())
      status.value = { supported: true, registered: toolNames.length === THREAD_TOOL_NAMES.length, toolNames, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WebMCP tool registration failed.'
      status.value = { supported: true, registered: false, toolNames: [], error: message }
      console.warn('[THREAD] WebMCP registration failed:', error)
    }

    if (import.meta.hot) import.meta.hot.dispose(unregisterThreadTools)
  },
})
