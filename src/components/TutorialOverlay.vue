<script setup lang="ts">
import { ref, watch } from 'vue'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/assets/styles/tutorial.css'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()

const props = defineProps<{
  visible: boolean
  activeTab: string | null
  skipWelcome?: boolean
}>()

const emit = defineEmits<{
  start: []
  skip: []
  zoomToSource: []
  scrollDetailsToTop: []
  bookmarkSource: []
  openDetailsTab: []
  cleanup: []
}>()

const showWelcome = ref(true)
const currentStepIndex = ref(0)
let driverInstance: ReturnType<typeof driver> | null = null

// Watch for visibility changes to handle skipWelcome
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.skipWelcome) {
      startTour()
    } else if (visible) {
      showWelcome.value = true
    }
  },
)

const steps: DriveStep[] = [
  {
    element: '#search-tab',
    popover: {
      side: 'top',
      title: 'Search',
      description: 'Open the search panel to build a graph.',
      showButtons: [],
    },
    disableActiveInteraction: false,
  },
  {
    element: '#search-content',
    popover: {
      side: 'top',
      title: 'Build a Graph',
      description: "You need a DOI to build a graph. Let's hit Build and create our first graph.",
      showButtons: [],
    },
    disableActiveInteraction: false,
  },
  {
    element: '#search-content',
    popover: {
      side: 'right',
      title: 'Building...',
      description:
        'Oignon searches several thousand related publications to build a graph. This might take a moment, hang tight!',
      showButtons: [],
    },
  },
  {
    element: '#graph-canvas',
    popover: {
      side: 'top',
      title: 'Graph Built',
      description: 'Great, looks like the graph built.',
      showButtons: ['next'],
      nextBtnText: 'Next',
      onNextClick: () => {
        emit('zoomToSource')
        currentStepIndex.value++
        driverInstance?.moveNext()
      },
    },
  },
  {
    element: '#graph-canvas',
    popover: {
      side: 'top',
      title: 'Nodes & Connections',
      description:
        'Each node is a publication that you can select for inspection. Lines show connections between citing and cited publications.',
      showButtons: ['next'],
      nextBtnText: 'Next',
      onNextClick: () => {
        currentStepIndex.value++
        driverInstance?.moveNext()
      },
    },
  },
  {
    element: '#year-axis-target',
    popover: {
      side: 'right',
      title: 'Year Axis',
      description:
        'Year axis labels show the year of publication. Years without publications in the graph are skipped.',
      showButtons: ['next'],
      nextBtnText: 'Next',
      onNextClick: () => {
        currentStepIndex.value++
        driverInstance?.moveNext()
      },
    },
  },
  {
    element: '#details-panel',
    popover: {
      side: 'top',
      title: 'Metadata Panel',
      description: 'The metadata panel shows all the usual information about a publication.',
      showButtons: ['next'],
      nextBtnText: 'Next',
      onNextClick: () => {
        emit('scrollDetailsToTop')
        currentStepIndex.value++
        driverInstance?.moveNext()
      },
    },
  },
  {
    element: '#details-actions',
    popover: {
      side: 'bottom',
      title: 'Quick Actions',
      description: 'Use the buttons to navigate to the publication links, or to bookmark it.',
      showButtons: ['next'],
      nextBtnText: 'Next',
      onNextClick: () => {
        emit('bookmarkSource')
        currentStepIndex.value++
        driverInstance?.moveNext()
      },
    },
  },
  {
    element: '#library-tab',
    popover: {
      side: 'top',
      title: 'Library',
      description: "Let's have a quick peek at the library.",
      showButtons: [],
    },
    disableActiveInteraction: false,
  },
  {
    element: '#library-panel',
    popover: {
      side: 'top',
      title: 'Library',
      description:
        'Here you can see your bookmarked papers. Oignon also saves your recent graphs here, too.',
      showButtons: ['next'],
      nextBtnText: 'Next',
      onNextClick: () => {
        currentStepIndex.value++
        driverInstance?.moveNext()
      },
    },
  },
  {
    element: '#graph-canvas',
    popover: {
      side: 'top',
      title: 'Explore',
      description: 'Try selecting a different node to see its details.',
      showButtons: [],
    },
    disableActiveInteraction: false,
  },
  {
    element: '#details-panel',
    popover: {
      side: 'top',
      title: "That's It!",
      description:
        "Nice choice. You can hit the hammer icon to build a new graph from this publication. But for now, that's all!",
      showButtons: ['next'],
      nextBtnText: 'Finish',
      onNextClick: () => {
        emit('cleanup')
        driverInstance?.destroy()
        driverInstance = null
        emit('start')
      },
    },
  },
]

function advanceStep() {
  if (!driverInstance) return

  currentStepIndex.value++
  if (currentStepIndex.value < steps.length) {
    driverInstance.moveNext()
  } else {
    driverInstance.destroy()
    emit('start')
  }
}

// Watch for tab changes to advance the tour
watch(
  () => props.activeTab,
  (newTab) => {
    if (!driverInstance || !props.visible) return

    // Step 0: waiting for search tab to open
    if (currentStepIndex.value === 0 && newTab === 'search') {
      // Wait for the panel to render before advancing
      setTimeout(() => {
        advanceStep()
      }, 100)
    }

    // Step 8: waiting for library tab to open
    if (currentStepIndex.value === 8 && newTab === 'library') {
      // Wait longer for panel animation to complete
      setTimeout(() => {
        advanceStep()
      }, 300)
    }
  },
)

// Watch for build to start/finish (loading state)
watch(
  () => store.loading,
  (loading) => {
    if (!driverInstance || !props.visible) return

    // Step 1: waiting for build to start
    if (currentStepIndex.value === 1 && loading) {
      advanceStep()
    }

    // Step 2: waiting for build to finish
    if (currentStepIndex.value === 2 && !loading) {
      advanceStep()
    }
  },
)

// Watch for node selection (step 9: user selects a different node)
watch(
  () => store.selectedNodes[0],
  (selectedNode) => {
    if (!driverInstance || !props.visible) return

    // Step 10: waiting for user to select a different node
    if (currentStepIndex.value === 10 && selectedNode) {
      const sourceId = store.sourceNode?.id
      if (selectedNode.id !== sourceId) {
        emit('openDetailsTab')
        // Give time for the panel to open and settle
        setTimeout(() => {
          emit('scrollDetailsToTop')
          advanceStep()
        }, 300)
      }
    }
  },
)

// Watch for graph loading (handles cached graphs that skip the loading state)
watch(
  () => store.graph,
  (graph) => {
    if (!driverInstance || !props.visible || !graph) return

    // Step 1: if graph loads without loading state (cached), skip to step 3 (graph built)
    if (currentStepIndex.value === 1) {
      // Jump directly to step 3 (index 3 = graph built)
      currentStepIndex.value = 3
      driverInstance.drive(3)
    }
  },
)

function handleSkipTour() {
  driverInstance?.destroy()
  driverInstance = null
  emit('skip')
}

function startTour() {
  // Reset to clean state before starting
  emit('cleanup')

  showWelcome.value = false
  currentStepIndex.value = 0

  driverInstance = driver({
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.85)',
    stagePadding: 10,
    stageRadius: 10,
    allowClose: false,
    showButtons: [],
    showProgress: false,
    disableActiveInteraction: true,
    onDestroyStarted: () => {
      driverInstance?.destroy()
      driverInstance = null
      emit('start')
    },
    steps,
  })

  driverInstance.drive()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible && showWelcome" class="tutorial-overlay">
      <div class="welcome-card">
        <h2 class="welcome-title">Hey, looks like you're new here.</h2>
        <p class="welcome-description">Tap to get started.</p>
        <div class="welcome-actions">
          <button class="btn-start" @click="startTour">Get Started</button>
          <button class="btn-skip" @click="emit('skip')">Skip</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Skip button visible during tour -->
  <button v-if="visible && !showWelcome" class="skip-tutorial-btn" @click="handleSkipTour">
    Skip tutorial
  </button>
</template>

<style scoped>
.tutorial-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-card {
  background: var(--bg-panel-solid);
  border: 1px solid var(--border-light);
  border-radius: var(--panel-radius);
  padding: var(--spacing-xl);
  max-width: 300px;
  text-align: center;
}

.welcome-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-sm) 0;
}

.welcome-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-lg) 0;
}

.welcome-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
}

.btn-start {
  background: var(--accent-blue);
  border: 1px solid var(--accent-blue);
  border-radius: var(--btn-radius);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-start:hover {
  background: var(--accent-blue-light);
  border-color: var(--accent-blue-light);
}

.btn-skip {
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-skip:hover {
  background: var(--btn-bg-hover);
  border-color: var(--btn-border-hover);
  color: var(--text-primary);
}

.skip-tutorial-btn {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: 1000001;
  background: var(--bg-panel-solid);
  border: 1px solid var(--border-light);
  border-radius: var(--btn-radius);
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  pointer-events: auto;
  transition: all var(--transition-fast);
}

.skip-tutorial-btn:hover {
  background: var(--btn-bg-hover);
  border-color: var(--btn-border-hover);
  color: var(--text-primary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
