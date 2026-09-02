import { computed, ref } from 'vue'

// React-style function component — the auto-define babel plugin wraps it
// into defineComponent, so the refs below survive re-renders
export default function Counter() {
  const count = ref(0)
  const double = computed(() => count.value * 2)

  return (
    <div class="counter">
      <button onClick={() => count.value--}>−</button>
      <span class="count">{count.value}</span>
      <button onClick={() => count.value++}>+</button>
      <p class="double">double: {double.value}</p>
    </div>
  )
}
