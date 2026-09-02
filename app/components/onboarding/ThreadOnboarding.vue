<script setup lang="ts">
import { ArrowRight, X } from 'lucide-vue-next'
import type { ProfileInput } from '~/domain/profile/profile'
import { MIN_PROFILE_STYLES, SHOPPING_DEPARTMENTS, type ShoppingDepartment, type StyleId, type StyleProfile } from '~/types/thread'

const props = withDefaults(defineProps<{ profile?: StyleProfile | null; editing?: boolean }>(), {
  profile: null,
  editing: false,
})
const emit = defineEmits<{
  save: [profile: ProfileInput]
  cancel: []
}>()

const name = ref(props.profile?.name ?? '')
const shoppingDepartment = ref<ShoppingDepartment | ''>(props.profile?.shoppingDepartment ?? '')
const styles = ref<StyleId[]>(props.profile ? [...props.profile.styles] : [])
const genderIdentity = ref(props.profile?.genderIdentity ?? '')
const racialIdentity = ref(props.profile?.racialIdentity ?? '')
const heightCm = ref(props.profile?.heightCm?.toString() ?? '')
const weightKg = ref(props.profile?.weightKg?.toString() ?? '')
const topSize = ref(props.profile?.clothingSizes?.tops ?? '')
const bottomSize = ref(props.profile?.clothingSizes?.bottoms ?? '')
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
  if (styles.value.length < MIN_PROFILE_STYLES) {
    error.value = `Choose at least ${MIN_PROFILE_STYLES} styles.`
    return
  }
  if (!shoppingDepartment.value) {
    error.value = 'Choose who you are shopping for.'
    return
  }
  const parsedHeight = heightCm.value ? Number(heightCm.value) : undefined
  const parsedWeight = weightKg.value ? Number(weightKg.value) : undefined
  if (parsedHeight !== undefined && (!Number.isFinite(parsedHeight) || parsedHeight < 80 || parsedHeight > 250)) {
    error.value = 'Enter a height between 80 and 250 cm.'
    return
  }
  if (parsedWeight !== undefined && (!Number.isFinite(parsedWeight) || parsedWeight < 20 || parsedWeight > 400)) {
    error.value = 'Enter a weight between 20 and 400 kg.'
    return
  }
  emit('save', {
    name: name.value.trim(),
    shoppingDepartment: shoppingDepartment.value,
    styles: styles.value,
    genderIdentity: genderIdentity.value.trim() || undefined,
    racialIdentity: racialIdentity.value.trim() || undefined,
    heightCm: parsedHeight,
    weightKg: parsedWeight,
    clothingSizes: {
      tops: topSize.value.trim() || undefined,
      bottoms: bottomSize.value.trim() || undefined,
    },
  })
}
</script>

<template>
  <section class="relative flex min-h-dvh items-center bg-transparent px-5 py-12 sm:px-8" :aria-label="editing ? 'Edit style profile' : 'Create your Rove profile'">
    <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-thread-line" />
    <button
      v-if="editing"
      type="button"
      class="rove-glass absolute right-5 top-5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border transition hover:border-thread-ink sm:right-8 sm:top-8"
      aria-label="Close profile settings"
      @click="emit('cancel')"
    >
      <X class="h-5 w-5" aria-hidden="true" />
    </button>

    <div class="rove-glass-strong mx-auto w-full max-w-3xl rounded-[2rem] border p-6 sm:p-10 lg:p-12">
      <RoveLogo class="mb-12" />
      <div class="mb-10 max-w-2xl">
        <p class="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-thread-accent">{{ editing ? 'Your profile' : 'Welcome to Rove' }}</p>
        <h1 class="font-editorial text-5xl leading-[0.95] tracking-[-0.025em] text-thread-ink sm:text-7xl">
          {{ editing ? 'Refine your point of view.' : 'Your wardrobe for the web.' }}
        </h1>
        <p class="mt-5 max-w-lg text-base leading-7 text-thread-muted">
          {{ editing ? 'Update what Rove uses to shape your recommendations.' : 'Give Rove a starting point for your personal style.' }}
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
            class="h-14 w-full rounded-xl border border-thread-line bg-white/70 px-4 text-base text-thread-ink placeholder:text-thread-muted/65 transition hover:border-thread-accent focus:border-thread-ink focus:outline-none"
            placeholder="First name"
            :aria-invalid="Boolean(error && !name.trim())"
          >
        </div>

        <fieldset>
          <legend class="mb-3 text-sm font-medium text-thread-ink">Who are you shopping for?</legend>
          <p class="mb-4 text-xs leading-5 text-thread-muted">This helps Rove choose the right departments. You can still search every store.</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="option in SHOPPING_DEPARTMENTS"
              :key="option.id"
              type="button"
              class="min-h-[76px] cursor-pointer rounded-2xl border px-4 py-3 text-left transition"
              :class="shoppingDepartment === option.id ? 'border-thread-ink bg-thread-ink text-white' : 'border-thread-line bg-thread-surface hover:border-thread-ink'"
              :aria-pressed="shoppingDepartment === option.id"
              @click="shoppingDepartment = option.id"
            >
              <span class="block text-sm font-medium">{{ option.label }}</span>
              <span class="mt-1 block text-xs leading-5" :class="shoppingDepartment === option.id ? 'text-white/65' : 'text-thread-muted'">{{ option.description }}</span>
            </button>
          </div>
        </fieldset>

        <StyleSelector v-model="styles" />

        <details class="overflow-hidden rounded-2xl border border-thread-line bg-white/55">
          <summary class="cursor-pointer px-4 py-4 text-sm font-medium text-thread-ink">Fit and identity details <span class="ml-2 text-xs font-normal text-thread-muted">Optional</span></summary>
          <div class="grid gap-5 border-t border-thread-line p-4 sm:grid-cols-2">
            <div>
              <label for="thread-gender-identity" class="mb-2 block text-xs font-medium text-thread-ink">Gender identity</label>
              <input id="thread-gender-identity" v-model="genderIdentity" type="text" autocomplete="sex" maxlength="80" class="h-12 w-full rounded-xl border border-thread-line bg-white/65 px-3 text-sm focus:border-thread-ink focus:outline-none" placeholder="e.g. man">
            </div>
            <div>
              <label for="thread-racial-identity" class="mb-2 block text-xs font-medium text-thread-ink">Racial or cultural identity</label>
              <input id="thread-racial-identity" v-model="racialIdentity" type="text" maxlength="80" class="h-12 w-full rounded-xl border border-thread-line bg-white/65 px-3 text-sm focus:border-thread-ink focus:outline-none" placeholder="Optional, self-described">
            </div>
            <div>
              <label for="thread-height" class="mb-2 block text-xs font-medium text-thread-ink">Height (cm)</label>
              <input id="thread-height" v-model="heightCm" type="number" inputmode="decimal" min="80" max="250" step="0.01" class="h-12 w-full rounded-xl border border-thread-line bg-white/65 px-3 text-sm tabular-nums focus:border-thread-ink focus:outline-none" placeholder="180">
            </div>
            <div>
              <label for="thread-weight" class="mb-2 block text-xs font-medium text-thread-ink">Weight (kg)</label>
              <input id="thread-weight" v-model="weightKg" type="number" inputmode="decimal" min="20" max="400" step="0.1" class="h-12 w-full rounded-xl border border-thread-line bg-white/65 px-3 text-sm tabular-nums focus:border-thread-ink focus:outline-none" placeholder="81">
            </div>
            <div>
              <label for="thread-top-size" class="mb-2 block text-xs font-medium text-thread-ink">Usual top size</label>
              <input id="thread-top-size" v-model="topSize" type="text" maxlength="20" class="h-12 w-full rounded-xl border border-thread-line bg-white/65 px-3 text-sm uppercase focus:border-thread-ink focus:outline-none" placeholder="L">
            </div>
            <div>
              <label for="thread-bottom-size" class="mb-2 block text-xs font-medium text-thread-ink">Usual bottom size</label>
              <input id="thread-bottom-size" v-model="bottomSize" type="text" maxlength="20" class="h-12 w-full rounded-xl border border-thread-line bg-white/65 px-3 text-sm uppercase focus:border-thread-ink focus:outline-none" placeholder="XL">
            </div>
            <p class="sm:col-span-2 text-xs leading-5 text-thread-muted">These details stay in this browser. Rove preserves self-described identity but does not infer skin tone from racial identity.</p>
          </div>
        </details>

        <p v-if="error" role="alert" class="text-sm font-medium text-thread-danger">{{ error }}</p>

        <div class="flex flex-col gap-3 border-t border-thread-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p class="max-w-sm text-xs leading-5 text-thread-muted">Saved only in this browser. Change it anytime from your profile.</p>
          <button type="submit" class="flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-thread-ink px-6 text-sm font-medium text-white shadow-soft transition hover:bg-thread-accent sm:min-w-44">
            {{ editing ? 'Save profile' : 'Enter Rove' }}
            <ArrowRight class="h-4 w-4" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
