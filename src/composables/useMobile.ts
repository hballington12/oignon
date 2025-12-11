import { ref, onMounted, onUnmounted } from 'vue'
import { MOBILE_BREAKPOINT } from '@/types/mobile'

const isMobile = ref(false)

function update() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
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

  return { isMobile }
}
