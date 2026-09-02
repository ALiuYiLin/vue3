import { ref } from 'vue'
import Card from './components/Card'
import Counter from './components/Counter'
import Greeting from './components/Greeting'
import TodoList from './components/TodoList'

// React-style function component — auto-wrapped into defineComponent
export default function App() {
  const show = ref(true)
  const todos = ref(['learn JSX', 'drop slots', 'enjoy the fork'])

  return (
    <div class="app">
      <h1>Vue JSX Playground</h1>
      <p class="tagline">
        A JSX-only Vue fork: runtime everywhere, no template compiler. Children
        live in <code>props.children</code>.
      </p>

      <section>
        <h2>Reactivity · events · v-show</h2>
        <Counter />
        <p>
          <button onClick={() => (show.value = !show.value)}>toggle</button>
          <span v-show={show.value}>conditional text (v-show)</span>
        </p>
        {show.value ? <p>also rendered via ternary</p> : null}
      </section>

      <section>
        <h2>Function children (slot replacement)</h2>
        <Card title="Card with function children">
          {props => <p class="card-msg">children fn: {props.msg}</p>}
        </Card>
      </section>

      <section>
        <h2>Typed props · emit convention</h2>
        <Greeting name="Vue" onGreet={msg => alert(msg)} />
      </section>

      <section>
        <h2>Keyed list</h2>
        <TodoList items={todos.value} />
      </section>

      <footer>
        props / attrs fallthrough: <code>{new Date().getFullYear()}</code>
      </footer>
    </div>
  )
}
