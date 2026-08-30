<script setup lang="ts">
import { ArrowRight, X } from 'lucide-vue-next'
import { SHOPPING_GENDERS, type ShoppingGender, type StyleId, type StyleProfile } from '~/types/thread'

const props = withDefaults(defineProps<{ profile?: StyleProfile | null; editing?: boolean }>(), {
  profile: null,
  editing: false,
})
const emit = defineEmits<{
  save: [profile: { name: string; gender: ShoppingGender; styles: StyleId[] }]
  cancel: []
}>()

const name = ref(props.profile?.name ?? '')
const gender = ref<ShoppingGender | ''>(props.profile?.gender ?? '')
const styles = ref<StyleId[]>(props.profile ? [...props.profile.styles] : [])
const error = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

onMounted(() => nameInput.value?.focus())

function submit() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Enter your first name to continue.'
    nameInput.value?.focus()
    return
  }
  if (!styles.value.length) {
    error.value = 'Choose at least one style.'
    return
  }
  if (!gender.value) {
    error.value = 'Choose who you are shopping for.'
    return
  }
  emit('save', { name: name.value.trim(), gender: gender.value, styles: styles.value })
}
</script>

<template>
  <section class="relative flex min-h-dvh items-center bg-thread-canvas px-5 py-12 sm:px-8" :aria-label="editing ? 'Edit style profile' : 'Create your Thread profile'">
    <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-thread-line" />
    <button
      v-if="editing"
      type="button"
      class="absolute right-5 top-5 flex h-11 w-11 cursor-pointer items-center justify-center border border-thread-line bg-thread-surface transition hover:border-thread-ink sm:right-8 sm:top-8"
      aria-label="Close profile settings"
      @click="emit('cancel')"
    >
      <X class="h-5 w-5" aria-hidden="true" />
    </button>

    <div class="mx-auto w-full max-w-3xl">
      <p class="mb-14 text-sm font-semibold tracking-[0.28em]">THREAD</p>
      <div class="mb-10 max-w-2xl">
        <p class="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-thread-accent">{{ editing ? 'Your profile' : 'Welcome to Thread' }}</p>
        <h1 class="font-editorial text-5xl leading-[0.95] tracking-[-0.025em] text-thread-ink sm:text-7xl">
          {{ editing ? 'Refine your point of view.' : 'Your wardrobe for the web.' }}
        </h1>
        <p class="mt-5 max-w-lg text-base leading-7 text-thread-muted">
          {{ editing ? 'Update what Thread uses to shape your recommendations.' : 'Tell Thread a little about your style.' }}
        </p>
      </div>

      <form class="space-y-8" novalidate @submit.prevent="submit">
        <div>
          <label for="thread-name" class="mb-3 block text-sm font-medium text-thread-ink">What's your name?</label>
          <input
            id="thread-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="given-name"
            maxlength="40"
            class="h-14 w-full border border-thread-line bg-thread-surface px-4 text-base text-thread-ink placeholder:text-thread-muted/65 transition hover:border-thread-accent focus:border-thread-ink focus:outline-none"
            placeholder="First name"
            :aria-invalid="Boolean(error && !name.trim())"
          >
        </div>

        <fieldset>
          <legend class="mb-3 text-sm font-medium text-thread-ink">Who are you shopping for?</legend>
          <p class="mb-4 text-xs leading-5 text-thread-muted">This helps Thread choose the right departments. You can still search every store.</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="option in SHOPPING_GENDERS"
              :key="option.id"
              type="button"
              class="min-h-[76px] cursor-pointer border px-4 py-3 text-left transition"
              :class="gender === option.id ? 'border-thread-ink bg-thread-ink text-white' : 'border-thread-line bg-thread-surface hover:border-thread-ink'"
              :aria-pressed="gender === option.id"
              @click="gender = option.id"
            >
              <span class="block text-sm font-medium">{{ option.label }}</span>
              <span class="mt-1 block text-xs leading-5" :class="gender === option.id ? 'text-white/65' : 'text-thread-muted'">{{ option.description }}</span>
            </button>
          </div>
        </fieldset>

        <StyleSelector v-model="styles" />

        <p v-if="error" role="alert" class="text-sm font-medium text-thread-danger">{{ error }}</p>

        <div class="flex flex-col gap-3 border-t border-thread-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p class="max-w-sm text-xs leading-5 text-thread-muted">Saved only in this browser. Change it anytime from your profile.</p>
          <button type="submit" class="flex min-h-12 cursor-pointer items-center justify-center gap-3 bg-thread-ink px-6 text-sm font-medium text-white transition hover:bg-thread-accent sm:min-w-44">
            {{ editing ? 'Save profile' : 'Enter Thread' }}
            <ArrowRight class="h-4 w-4" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
