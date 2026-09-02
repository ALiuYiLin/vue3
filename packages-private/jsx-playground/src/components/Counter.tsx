import { computed, defineComponent, ref } from 'vue'

export default defineComponent({
  setup() {
    const count = ref(0)
    const double = computed(() => count.value * 2)

    return () => (
      <div class="counter">
        <button onClick={() => count.value--}>−</button>
        <span class="count">{count.value}</span>
        <button onClick={() => count.value++}>+</button>
        <p class="double">double: {double.value}</p>
      </div>
    )
  },
})
