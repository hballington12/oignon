import { ref, onMounted, onUnmounted } from 'vue'
import { MOBILE_BREAKPOINT } from '@/types/mobile'

const isMobile = ref(false)
const isTouchDevice = ref(false)

function checkTouchDevice(): boolean {
  // Primary check: coarse pointer (finger) + no hover capability
  const mediaMatch = window.matchMedia('(pointer: coarse) and (hover: none)').matches

  // Fallback for older browsers
  const hasTouchEvents = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  return mediaMatch || hasTouchEvents
}

function update() {
  const isNarrow = window.innerWidth < MOBILE_BREAKPOINT
  isTouchDevice.value = checkTouchDevice()

  // Mobile UI if:
  // - No mouse support (touch-only) = always mobile
  // - Has mouse support = mobile only if narrow screen
  isMobile.value = isTouchDevice.value || isNarrow
}

let initialized = false
let listenerCount = 0

export function useMobile() {
  onMounted(() => {
    if (!initialized) {
      update()
      initialized = true
    }
    if (listenerCount === 0) {
      window.addEventListener('resize', update)
    }
    listenerCount++
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      window.removeEventListener('resize', update)
    }
  })

  return { isMobile, isTouchDevice }
}
