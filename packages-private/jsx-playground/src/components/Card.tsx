interface CardProps {
  title: string
  children?: (scope: { msg: string }) => any
}

export default function Card(props: CardProps) {
  return (
    <div class="card">
      <h3>{props.title}</h3>
      <div class="card-body">
        {props.children
          ? props.children({ msg: 'hello from children fn' })
          : null}
      </div>
    </div>
  )
}
