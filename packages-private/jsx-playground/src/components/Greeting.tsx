interface GreetingProps {
  name: string
  onGreet?: (msg: string) => void
}

export default function Greeting(props: GreetingProps) {
  return (
    <div class="greeting">
      <span>Hello, {props.name}!</span>
      <button
        onClick={() => {
          if (props.onGreet) props.onGreet(`hi from ${props.name}`)
        }}
      >
        emit (onGreet)
      </button>
    </div>
  )
}
