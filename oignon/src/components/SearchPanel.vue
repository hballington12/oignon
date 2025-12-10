<script setup lang="ts">
import { ref } from 'vue'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()
const query = ref('')
const isOpen = ref(true)

const emit = defineEmits<{
  search: [query: string]
}>()

function handleSubmit() {
  if (!query.value.trim()) return
  emit('search', query.value.trim())
}

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="search-panel" :class="{ collapsed: !isOpen }">
    <button class="toggle-btn" @click="toggle">
      {{ isOpen ? '−' : '+' }}
    </button>
    
    <div v-if="isOpen" class="search-content">
      <h3>Paper Graph</h3>
      <form @submit.prevent="handleSubmit">
        <input
          v-model="query"
          type="text"
          placeholder="Enter DOI or OpenAlex ID"
          :disabled="store.loading"
        />
        <button type="submit" :disabled="store.loading || !query.trim()">
          {{ store.loading ? 'Building...' : 'Build Graph' }}
        </button>
      </form>
      
      <div v-if="store.loadingProgress" class="progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: store.loadingProgress.percent + '%' }"
          ></div>
        </div>
        <span class="progress-text">{{ store.loadingProgress.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(30, 30, 50, 0.95);
  border-radius: 8px;
  padding: 16px;
  min-width: 280px;
  color: #fff;
  z-index: 100;
}

.search-panel.collapsed {
  min-width: auto;
  padding: 8px;
}

.toggle-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
}

.toggle-btn:hover {
  color: #fff;
}

h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #aaa;
}

form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

input {
  padding: 10px 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #2a2a3e;
  color: #fff;
  font-size: 14px;
}

input:focus {
  outline: none;
  border-color: #667;
}

input::placeholder {
  color: #666;
}

button[type="submit"] {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  background: #4a5568;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

button[type="submit"]:hover:not(:disabled) {
  background: #5a6578;
}

button[type="submit"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress {
  margin-top: 12px;
}

.progress-bar {
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #6b8afd;
  transition: width 0.3s ease;
}

.progress-text {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #888;
}
</style>
