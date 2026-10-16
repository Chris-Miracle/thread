<script setup lang="ts">
import { ChevronDown, X } from 'lucide-vue-next'
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
const country = ref(props.profile?.destination?.country ?? '')
const region = ref(props.profile?.destination?.region ?? '')
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
  const countryCode = country.value.trim().toUpperCase()
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    error.value = 'Enter a two-letter delivery country code, such as CA.'
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
    destination: countryCode ? { country: countryCode, region: region.value.trim() || undefined } : null,
  })
}
</script>
<template>
  <section class="relative min-h-dvh bg-thread-canvas px-4 pb-16 pt-14 sm:px-6 sm:pt-20" :aria-label="editing ? 'Edit style profile' : 'Create your Rove profile'">
    <button
      v-if="editing"
      type="button"
      class="rove-icon-btn absolute right-4 top-4 bg-thread-fill sm:right-6 sm:top-6"
      aria-label="Close profile settings"
      @click="emit('cancel')"
    >
      <X class="h-[18px] w-[18px]" :stroke-width="2" aria-hidden="true" />
    </button>

    <div class="mx-auto w-full max-w-[640px]">
      <div class="text-center">
        <RoveLogo mark-only class="justify-center [&>svg]:h-14 [&>svg]:w-14 [&>svg]:shadow-raised [&>svg]:rounded-[15px]" />
        <h1 class="rove-headline mt-7 text-balance text-[36px] leading-[1.08] sm:text-[48px]">
          {{ editing ? 'Your style profile' : 'Your wardrobe for the web.' }}
        </h1>
        <p class="mx-auto mt-3 max-w-md text-pretty text-[17px] leading-[1.5] text-thread-muted">
          {{ editing ? 'Rove uses this to shape every edit.' : 'Tell Rove a little about your style. It takes a minute.' }}
        </p>
      </div>

      <form class="mt-10 space-y-4" novalidate @submit.prevent="submit">
        <div class="rove-card p-5 sm:p-6">
          <label for="thread-name" class="block text-[15px] font-semibold">Name</label>
          <input
            id="thread-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="given-name"
            maxlength="40"
            class="rove-input mt-3"
            placeholder="First name"
            :aria-invalid="Boolean(error && !name.trim())"
          >
        </div>

        <fieldset class="rove-card p-5 sm:p-6">
          <legend class="sr-only">Who are you shopping for?</legend>
          <p class="text-[15px] font-semibold" aria-hidden="true">Shopping for</p>
          <p class="mt-0.5 text-[13px] text-thread-muted">Sets which departments Rove checks first.</p>
          <div class="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-thread-canvas p-1 shadow-inset-hairline">
            <button
              v-for="option in SHOPPING_DEPARTMENTS"
              :key="option.id"
              type="button"
              class="h-10 cursor-pointer rounded-[9px] text-[14px] font-medium transition duration-200"
              :class="shoppingDepartment === option.id ? 'bg-thread-elevated text-thread-ink shadow-raised' : 'text-thread-muted hover:text-thread-ink'"
              :aria-pressed="shoppingDepartment === option.id"
              :title="option.description"
              @click="shoppingDepartment = option.id"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>

        <div class="rove-card p-5 sm:p-6">
          <StyleSelector v-model="styles" />
        </div>

        <details class="rove-card group overflow-hidden">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>
              <span class="block text-[15px] font-semibold">Fit and identity</span>
              <span class="block text-[13px] text-thread-muted">Optional · helps with sizing</span>
            </span>
            <ChevronDown class="h-5 w-5 text-thread-muted transition duration-300 group-open:rotate-180" :stroke-width="2" aria-hidden="true" />
          </summary>
          <div class="grid gap-4 border-t border-thread-line p-5 sm:grid-cols-2 sm:px-6">
            <div>
              <label for="thread-gender-identity" class="mb-1.5 block text-[13px] font-medium">Gender identity</label>
              <input id="thread-gender-identity" v-model="genderIdentity" type="text" autocomplete="sex" maxlength="80" class="rove-input h-11" placeholder="e.g. man">
            </div>
            <div>
              <label for="thread-racial-identity" class="mb-1.5 block text-[13px] font-medium">Racial or cultural identity</label>
              <input id="thread-racial-identity" v-model="racialIdentity" type="text" maxlength="80" class="rove-input h-11" placeholder="Self-described">
            </div>
            <div>
              <label for="thread-height" class="mb-1.5 block text-[13px] font-medium">Height (cm)</label>
              <input id="thread-height" v-model="heightCm" type="number" inputmode="decimal" min="80" max="250" step="0.01" class="rove-input h-11 tabular-nums" placeholder="180">
            </div>
            <div>
              <label for="thread-weight" class="mb-1.5 block text-[13px] font-medium">Weight (kg)</label>
              <input id="thread-weight" v-model="weightKg" type="number" inputmode="decimal" min="20" max="400" step="0.1" class="rove-input h-11 tabular-nums" placeholder="81">
            </div>
            <div>
              <label for="thread-top-size" class="mb-1.5 block text-[13px] font-medium">Top size</label>
              <input id="thread-top-size" v-model="topSize" type="text" maxlength="20" class="rove-input h-11 uppercase" placeholder="L">
            </div>
            <div>
              <label for="thread-bottom-size" class="mb-1.5 block text-[13px] font-medium">Bottom size</label>
              <input id="thread-bottom-size" v-model="bottomSize" type="text" maxlength="20" class="rove-input h-11 uppercase" placeholder="XL">
            </div>
            <div>
              <label for="thread-country" class="mb-1.5 block text-[13px] font-medium">Delivery country</label>
              <input id="thread-country" v-model="country" type="text" autocomplete="country" maxlength="2" class="rove-input h-11 uppercase" placeholder="CA">
            </div>
            <div>
              <label for="thread-region" class="mb-1.5 block text-[13px] font-medium">Province or state</label>
              <input id="thread-region" v-model="region" type="text" autocomplete="address-level1" maxlength="40" class="rove-input h-11 uppercase" placeholder="ON">
            </div>
            <p class="text-pretty text-[12px] leading-[1.5] text-thread-muted sm:col-span-2">Stays in this browser. Country and province only tune Shop results — Rove never stores an address or infers skin tone from identity.</p>
          </div>
        </details>

        <p v-if="error" role="alert" class="rounded-2xl bg-thread-danger/[0.07] px-4 py-3 text-[14px] text-thread-danger">{{ error }}</p>

        <div class="pt-4">
          <button type="submit" class="rove-btn-primary min-h-[52px] w-full text-[17px]">
            {{ editing ? 'Save' : 'Continue' }}
          </button>
          <p class="mt-3 text-center text-[12px] text-thread-muted">Saved only in this browser.</p>
        </div>
      </form>
    </div>
  </section>
</template>
