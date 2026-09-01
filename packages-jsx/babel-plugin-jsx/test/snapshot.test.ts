import { transform } from '@babel/core'
import { expect, test } from 'vitest'
import JSX, { type VueJSXPluginOptions } from '../src/index.ts'

interface Test {
  name: string
  from: string
}

function transpile(source: string, options: VueJSXPluginOptions = {}) {
  return new Promise((resolve, reject) =>
    transform(
      source,
      {
        filename: '',
        presets: [],
        plugins: [[JSX, options]],
        configFile: false,
      },
      (error, result) => {
        if (error) {
          return reject(error)
        }
        resolve(result?.code)
      },
    ),
  )
}

;[
  {
    name: 'v-show',
    from: '<div v-show={x}>vShow</div>',
  },
  {
    name: 'custom directive',
    from: '<A vCus={x} />',
  },
  {
    name: 'Without props',
    from: '<a>a</a>',
  },
  {
    name: 'MereProps Order',
    from: '<button loading {...x} type="submit">btn</button>',
  },
  {
    name: 'Merge class/ style attributes into array',
    from: '<div class="a" class={b} style="color: red" style={s}></div>',
  },
  {
    name: 'single no need for a mergeProps call',
    from: '<div {...x}>single</div>',
  },
  {
    name: 'should keep `import * as Vue from "vue"`',
    from: `
      import * as Vue from 'vue';

      <div>Vue</div>
    `,
  },
  {
    name: 'specifiers should be merged into a single importDeclaration',
    from: `
      import { createVNode, Fragment as _Fragment } from 'vue';
      import { vShow } from 'vue'

      <_Fragment />
    `,
  },
  {
    name: 'Without JSX should work',
    from: `
      import { createVNode } from 'vue';
      createVNode('div', null, ['Without JSX should work']);
    `,
  },
  {
    name: 'reassign variable as component',
    from: `
      import { defineComponent } from 'vue';
      let a = 1;
      const A = defineComponent({
        setup(_, { attrs }) {
          return () => <span>{attrs.foo}</span>;
        },
      });

      const _a2 = 2;

      a = _a2;

      a = <A>{a}</A>;
    `,
  },
  {
    name: 'custom directive',
    from: `
      <>
        <A v-xxx={x} />
        <A v-xxx={[x]} />
        <A v-xxx={[x, 'y']} />
        <A v-xxx={[x, 'y', ['a', 'b']]} />
        <A v-xxx={[x, ['a', 'b']]} />
        <A v-xxx={[x, y, ['a', 'b']]} />
      </>
    `,
  },
  {
    name: 'directive in scope',
    from: `
      const vXxx = {};
      <A v-xxx />
    `,
  },
  {
    name: 'use "@jsx" comment specify pragma',
    from: `
      /* @jsx custom */
      <div id="custom">Hello</div>
    `,
  },
  {
    name: 'TemplateLiteral prop and event co-usage',
    from: '<div value={`${foo}`} onClick={() => foo.value++}></div>',
  },
].forEach(({ name, from }) => {
  test(name, async () => {
    expect(await transpile(from)).toMatchSnapshot(name)
  })
})

const overridePropsTests: Test[] = [
  {
    name: 'single',
    from: '<div {...a} />',
  },
  {
    name: 'multiple',
    from: '<A loading {...a} {...{ b: 1, c: { d: 2 } }} class="x" style={x} />',
  },
]

overridePropsTests.forEach(({ name, from }) => {
  test(`override props ${name}`, async () => {
    expect(await transpile(from, { mergeProps: false })).toMatchSnapshot(name)
  })
})

const childrenTests: Test[] = [
  {
    name: 'multiple expressions',
    from: '<A>{foo}{bar}</A>',
  },
  {
    name: 'single expression, function expression',
    from: `
      <A>{() => "foo"}</A>
    `,
  },
  {
    name: 'single expression, non-literal value',
    from: `
      const foo = () => 1;
      <A>{foo()}</A>;
    `,
  },
  {
    name: 'no directive in children',
    from: `
      <>
        <A><div />{foo}</A>
        <A>
          <B><div />{foo}</B>
        </A>
      </>
    `,
  },
  {
    name: 'directive in children',
    from: `
      <>
        <A><div v-xxx />{foo}</A>
        <A>
          <B><div v-xxx />{foo}</B>
        </A>
      </>
    `,
  },
  {
    name: 'directive in children, in scope',
    from: `
      const vXxx = {};
      <>
        <A><div v-xxx />{foo}</A>
        <A>
          <B><div v-xxx />{foo}</B>
        </A>
      </>
    `,
  },
]

childrenTests.forEach(({ name, from }) => {
  test(`passing children via JSX ${name}`, async () => {
    expect(await transpile(from)).toMatchSnapshot(name)
  })
})

const pragmaTests = [
  {
    name: 'custom',
    from: '<div>pragma</div>',
  },
]

pragmaTests.forEach(({ name, from }) => {
  test(`set pragma to ${name}`, async () => {
    expect(await transpile(from, { pragma: 'custom' })).toMatchSnapshot(name)
  })
})

const isCustomElementTests = [
  {
    name: 'isCustomElement',
    from: '<foo><span>foo</span></foo>',
  },
]

isCustomElementTests.forEach(({ name, from }) => {
  test(name, async () => {
    expect(
      await transpile(from, { isCustomElement: tag => tag === 'foo' }),
    ).toMatchSnapshot(name)
  })
})

const fragmentTests = [
  {
    name: '_Fragment already imported',
    from: `
      import { Fragment as _Fragment } from 'vue'
      const Root1 = () => <>root1</>
      const Root2 = () => <_Fragment>root2</_Fragment>
      `,
  },
]

fragmentTests.forEach(({ name, from }) => {
  test(name, async () => {
    expect(await transpile(from)).toMatchSnapshot(name)
  })
})
