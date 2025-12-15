import { ref } from 'vue'

// Unified UI - always use mobile layout
const isMobile = ref(true)
const isTouchDevice = ref(true)

export function useMobile() {
  return { isMobile, isTouchDevice }
}
