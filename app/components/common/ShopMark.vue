<script setup lang="ts">
import { SHOP_LOGO } from '~/domain/research/shopRequests'

withDefaults(defineProps<{ size?: number }>(), { size: 16 })
</script>

<template>
  <img :src="SHOP_LOGO" alt="" :width="size" :height="size" class="shrink-0 rounded-[4px] bg-white object-contain" :style="{ width: `${size}px`, height: `${size}px` }">
</template>
