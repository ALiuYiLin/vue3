import { ref } from 'vue'

// React-style function component — auto-wrapped into defineComponent,
// `props` comes from the extracted runtime props declaration
export default function TodoList(props: { items: string[] }) {
  const done = ref<Set<string>>(new Set())
  const toggle = (item: string) => {
    const next = new Set(done.value)
    next.has(item) ? next.delete(item) : next.add(item)
    done.value = next
  }

  return (
    <ul class="todos">
      {props.items.map(item => (
        <li
          key={item}
          class={done.value.has(item) ? 'done' : ''}
          onClick={() => toggle(item)}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
