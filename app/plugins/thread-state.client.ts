export default defineNuxtPlugin({
  name: 'thread-state',
  enforce: 'pre',
  setup() {
    useThreadActions().hydrate()
  },
})
