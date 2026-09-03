# JSX-Only 重构设计文档（Vue 3 Runtime Fork）

> 范围：本 fork 相对上游 Vue 3.5.39 的全部结构性改动——设计思路、实现方式、
> 重构前后的关键差异（VNode 结构、patch/diff 流程、组件协议等）。
>
> 基线提交：`c0606e917 release: v3.5.39`

---

## 1. 背景与目标

### 1.1 为什么做这个 fork

上游 Vue 3 的架构是「**编译器 + 运行时双轨**」：

- 模板编译器把 `template` 编译成带 **patch flags / block / dynamicChildren** 的
  优化 VNode 树（编译期已知动态绑定位置，diff 时跳过静态内容）；
- 手写 render 函数（`h()` / JSX）走**另一条全量 diff 路径**；
- `slots` 作为模板特有的内容分发协议，与 `props` 并行存在；
- SFC 工具链（`compiler-sfc` / `compiler-dom` / `compiler-core`）、`KeepAlive` /
  `Suspense` / `Teleport` / `Transition` 等模板配套能力围绕编译器运转。

本 fork 的目标是**纯 JSX / render-function 形态的 Vue**：

1. **去掉编译器**——运行时不再依赖任何编译产物约定；
2. **单轨 VDOM**——只有一种 VNode 形态、一条 diff 路径，JSX 与手写 `h()`
   完全等价，无"优化模式 vs 普通模式"之分；
3. **React 风格的 props.children**——删除 `slots` 协议，内容分发统一走
   `props.children`，函数 children 替代 scoped slot；
4. 保留 Vue 的**响应式 / 组件模型 / 渲染器基础设施**（这是 fork 的价值所在）。

### 1.2 非目标

- 不实现 React 兼容层，不做 API 双写；
- 不追求模板场景的编译期优化（无编译器可优化）；
- 保留 Vue 语义的组件协议（props/emits/attrs/生命周期/依赖注入）。

---

## 2. 总体设计思路

### 2.1 编译器从运行时剥离

删掉编译器依赖后，运行时不再需要回答「这个 VNode 是不是编译器生成的」。
所有编译优化约定（`patchFlag`、`dynamicChildren` 块树、`setBlockTracking`、
`openBlock` 等）随之失效，从 VNode 结构与渲染器中整体移除——这是
**结构性简化**而非功能裁剪：运行时只服务"每次渲染重建整棵 VNode 树 +
全量 diff"这一种模型。

### 2.2 children 进 props：消除双通道

上游同时存在 `vnode.children`（元素/文本内容）与 `slots`（组件内容分发），
渲染器、SSR、hydration 都要分别处理两套协议。fork 统一为一条规则：

> **一切 children（文本 / VNode / VNode 数组 / 函数）都存储在 `props.children` 中。**

删除 `VNode.children` 字段后：

- 元素的文本/子节点 = `props.children`（string / 数组）；
- 组件的"插槽" = `props.children`（函数，渲染时调用，见 §4.3）；
- attrs 透传时 `children` 被特殊处理，永不落到 DOM 属性上（§4.4）。

### 2.3 JSX 作为一等公民

JSX 编译产物（`@vue/babel-plugin-jsx`，vendored 进 `packages-jsx/`）直接生成
`createVNode(type, props, children)`——与手写 `h()` 完全同构，没有独立运行时。
`packages-private/jsx-playground` 是可直接运行的示例（vite + babel 双插件 +
workspace 源码 alias）。

---

## 3. 重构阶段与提交映射

| 阶段 | 内容 | 提交 |
| --- | --- | --- |
| A | **slots 删除，children 移入 props**（VNode 结构 + 渲染器 + SSR 同步改） | `ef57d7633` |
| A | 内置组件删除（KeepAlive / Suspense / Teleport / Transition 运行时） | `8ee9c395e` |
| B | 编译优化标志删除（patch flags / block 相关） | `f439089af` |
| B | resolve-type 内联进 packages-jsx（保留 TS 声明 props → 运行时声明） | `60d003e02` |
| B | 删除 compiler-core/dom/sfc/ssr、vue-compat、playgrounds、模板配套 | `520ce3a13` |
| B | tsconfig/aliases 收尾 | `93bc6d97d` |
| D | 测试精选（模板用例删除 + fork 契约用例修正 + children attrs 修复） | `21a47c18e` |
| — | 新插件：函数组件自动包装 defineComponent（React 语义） | `cdfb932d0` |
| — | 可运行示例 jsx-playground | `ef302429c` 起 |

---

## 4. VNode 结构与核心机制

### 4.1 VNode 结构前后对比

**删除的字段（编译器契约）：**

| 上游字段 | 作用 | fork 处理 |
| --- | --- | --- |
| `children` | 元素/文本子节点 | **删除**——统一存 `props.children` |
| `patchFlag` | 编译器标记的动态绑定位 | **删除**——无编译器，diff 全量 |
| `dynamicProps` | 动态 props 键名数组 | **删除** |
| `dynamicChildren` | 块树动态子节点（优化 diff 入口） | **删除**——无块树 |
| `block` | 根块引用 | **删除** |

**保留的字段：** `type` / `props` / `key` / `ref` / `shapeFlag` / `el` /
`anchor` / `component` / `dirs` / `transition` / `scopeId` 等（DOM 挂载与
组件实例关联所需）。

`ShapeFlags.TEXT_CHILDREN / ARRAY_CHILDREN` 保留——仍用于区分
`props.children` 的形态，只是不再有编译产物配合。

### 4.2 children 归一化（normalizeChildren）

`createVNode(type, props, children)` 的第三个参数统一写入 `props.children`，
归一化规则（`packages/runtime-core/src/vnode.ts`）：

```
null/undefined         → props.children = null
数组                   → ARRAY_CHILDREN（原样）
单个 VNode             → 包成 [vnode]（ARRAY_CHILDREN）
对象（{default: fn}）  → 兼容旧 babel-plugin-jsx 产物：
                        元素 → 解包 default 并递归归一化
                        组件 → 丢弃（不再是合法 child）
函数（元素）           → 立即调用一次取结果（旧 jsx 编译产物形态）
函数（组件）           → 保留为函数（scoped slot 替代协议，§4.3）
其它（数字等）         → String() 转文本（TEXT_CHILDREN）
```

### 4.3 组件函数 children（scoped slot 的替代）

上游模板的 scoped slot 编译产物是「组件实例上的 `$slots` 对象 + 渲染时调用」。
fork 的等价物是一条简单的函数协议：

```tsx
// 父：把"插槽内容"作为函数传给组件
<Card title="hi">{scope => <p>{scope.msg}</p>}</Card>
//   → createVNode(Card, { title: 'hi' }, scope => ...)

// 子：props.children 是函数，渲染时调用（相当于 render 里取 slot）
function Card(props) {
  return props.children
    ? props.children({ msg: 'hello from children fn' })
    : null
}
```

要点：

- 函数 children **在 vnode 归一化时保留原样**（组件类型），由组件在渲染时
  自行调用——调用时机/次数归组件所有，等价于 scoped slot 的懒渲染；
- 元素类型上的函数 children 会被**立即调用一次**（旧 jsx 编译器把
  `{cond && <div/>}` 之类包成函数的产物形态，这里解包）；
- 函数 children 始终落在 `props` 上（`setFullProps` 对 `children` 键特判），
  因此 `$props.children`、setup 的 `props.children` 都能读到。

### 4.4 props / attrs 的 children 特殊通道

`setFullProps`（`componentProps.ts`）中 `children` 键被特判：

```ts
if (key === 'children') {
  if (!(options && hasOwn(options, camelize(key)))) {
    props[key] = rawProps[key]   // 永远进 props，绝不落入 attrs fallthrough
    continue
  }
}
```

配套保护（否则 children 会以属性的形式漏到 DOM 上）：

- **元素渲染器**（`patchProps` / `mountElement`）：循环跳过 `children` 键；
- **hydration**：属性比对跳过 `children`；
- **SSR**（`ssrRenderAttrs`）：`shouldIgnoreProp` 列表包含 `children`
  （上游列表漏了它，重构后 children 从 props 进入属性合并路径，曾造成
  SSR 输出 `<div children="2">` 的回归——已修复并有测试覆盖）；
- **attrs fallthrough**（`renderComponentRoot`）：合并 attrs 到根元素前剔除
  `children`，防止覆盖显式传入的 children。

### 4.5 函数组件的 props === attrs

上游中无 props 声明的函数组件 `instance.props === attrs`（所有传入键都可见）。
重构后 children 只进 props 对象，若照搬上游会让这类组件**读不到 children**。
修复（`initProps`）：

```ts
if (!instance.type.props) {
  instance.props = attrs
  // 函数组件以 attrs 充当 props 对象，children 也必须在 attrs 上可见
  if (rawProps && rawProps.children !== undefined) {
    attrs.children = rawProps.children
  }
}
```

有 props 声明的组件不受影响（children 走 §4.4 的 props 通道）。

---

## 5. patch / diff 流程前后对比

### 5.1 上游（编译器双轨）

```
patch(n1, n2)
├─ n2.dynamicChildren ?             ← 块树优化入口
│    patchBlockChildren（只 diff 动态节点，跳过静态）
├─ n2.patchFlag ?
│    patchElement 按 flag 分支：
│      TEXT → 只更新文本
│      CLASS / STYLE / PROPS → 只更新对应部分
│      FULL_PROPS → patchProps（带 dynamicProps 键名集）
│      NEED_PATCH → 事件/ref/指令
└─ 无 flag（手写 render）→ 全量 patchProps + patchChildren
```

块树机制（`openBlock` / `setBlockTracking` / `dynamicChildren`）由
编译器生成的代码驱动，运行时只能被动消费。

### 5.2 fork（单轨全量 diff）

```
patch(n1, n2)
├─ type 相同（元素）→ processElement
│    patchProps（全量键比对，跳过 key/ref/children）
│    patchChildren（§5.3）
├─ type 相同（组件）→ updateComponent
│    props / attrs 变化则重渲染（组件自身响应式依赖另驱动）
└─ type 不同 → unmount + mount
```

- **没有 patchFlag 分支**：每次更新对 props 做全量键比对、对 children 做
  结构 diff。代价是元素级"静态内容也被遍历"，换来的是**单一路径**：
  JSX、`h()`、未来任何生成 `createVNode` 的编译器产物行为完全一致；
- **Block 树机制整体移除**：无 `dynamicChildren` 概念，diff 始终从根递归；
- 组件实例的更新仍由**渲染 effect**（响应式依赖收集）驱动，与上游一致——
  组件内部 ref 变化不依赖父级 props 比较。

### 5.3 children diff

保留上游的完整策略，只是数据源从 `n1.children` 换成 `n1.props.children`：

- **keyed diff**（`patchKeyedChildren`）：双向头尾扫描 + key 映射 + 最长
  递增子序列，原样保留（JSX 列表渲染与模板 v-for 等价）；
- **unkeyed diff**：同长度逐个 patch，剩余部分 mount/unmount；
- **文本 ↔ 数组**：`hostSetElementText` / 整体替换。

> 取舍说明：删除 patch flags 意味着文本子节点更新不再有 `patchFlag & TEXT`
> 的快捷路径，但 `patchChildren` 内部对"旧文本 vs 新文本"仍有等值判断
> （`c1 !== c2` 才写 DOM），实际开销增长有限。

---

## 6. 组件协议变化

| 能力 | 上游 | fork |
| --- | --- | --- |
| 内容分发 | `slots` / `$slots` / `v-slot` | `props.children`（函数） |
| 默认插槽 | `$slots.default()` | `props.children()` |
| 具名插槽 | `$slots.foo` | 无（仅单通道 children） |
| scoped slot | `slotProps` 参数 | 函数 children 参数 |
| `<slot/>` 占位组件 | 内置 | **删除**（children 由父显式渲染） |
| `this.$slots` | 公开实例 API | **删除** |
| `useSlots()` | 组合式 API | **删除** |
| KeepAlive / Suspense / Teleport / Transition | 内置组件 | **删除**（模板专属） |
| `template:` 选项 / 运行时编译 | 有 | **删除**（编译不存在） |
| `v-model` / `v-show` 指令产物 | 编译器生成 | `v-show` 保留运行时指令，JSX 属性写法 `v-show={bool}` |
| 自定义指令 | 保留 | 保留（`withDirectives` / JSX 属性） |
| `defineProps<T>` 类型声明 | compiler-sfc | vendored `@vue/babel-plugin-resolve-type` 保留同等能力 |
| 函数组件 | 无状态 | 无状态（可选 auto-define 插件自动转有状态，§8） |

---

## 7. 包结构与删除清单

**当前包（workspace）：**

| 包 | 说明 |
| --- | --- |
| `packages/reactivity` | 保留（未动） |
| `packages/runtime-core` | 重构主体 |
| `packages/runtime-dom` | patchProps/事件/自定义元素等保留 |
| `packages/runtime-test` | 测试渲染器（nodeOps）保留 |
| `packages/server-renderer` | vnode 渲染保留；模板相关删除 |
| `packages/shared` | 保留（PatchFlags 枚举仍导出，已无运行时消费方） |
| `packages/vue` | runtime-only 入口（src: index/runtime/dev；server-renderer / jsx-runtime 桥接） |
| `packages-jsx/babel-plugin-jsx` | vendored JSX 编译器 |
| `packages-jsx/babel-plugin-resolve-type` | vendored 类型 → 运行时 props/emits |
| `packages-jsx/babel-plugin-auto-define-component` | 新增：React 风格函数组件自动包装 |
| `packages-jsx/babel-helper-vue-transform-on` | vendored 辅助 |
| `packages-private/jsx-playground` | 新增：可运行示例 |

**删除：** `compiler-core` / `compiler-dom` / `compiler-sfc` / `compiler-ssr`、
`vue-compat`、`@vue/compiler-*` 发布入口、`template-explorer` / `sfc-playground`、
`vue/__tests__/e2e`、vue 包内的 `compiler-sfc`/`examples` 残留目录。

---

## 8. babel-plugin-auto-define-component（React 语义层）

函数组件在 Vue 里天然无状态（每次渲染重跑函数体），而 React 心智模型里
"函数体里可以写 ref"。插件在**编译期**把 React 形态翻译成 Vue 模型：

```
function Counter() {                     defineComponent(function Counter() {
  const count = ref(0)                     const count = ref(0)   // ← setup，只跑一次
  return <span>{count.value}</span>   →    return () => <span>…</span>  // ← render
}                                        })
```

- 检测：PascalCase + 函数体含 JSX；`export default function`、箭头函数
  expression body 均支持；已手动 `defineComponent` 的代码跳过；
- props：第一参数类型注解 → 复用 vendored resolve-type 的
  `extractRuntimeProps` 生成运行时 `props` 声明；无注解时收集 `props.xxx`
  成员访问生成宽松声明（`{ xxx: null }`）；`children` 永远剔除；
- 非法形态：函数体内 `return () => <JSX/>`（显式 Vue 风格）编译期报错；
- `defineComponent` 导入自动注入（`@babel/helper-module-imports`）。

详见 `packages-jsx/babel-plugin-auto-define-component/src/`。

---

## 9. 测试策略

仓库进入"无编译器"状态后，模板依赖的测试全部失去意义。策略：

- **保留**：reactivity 全部；runtime-core 的组件 props/emits/生命周期/
  指令/apiCreateApp/vnode/renderer/hydration 基础；runtime-dom 的
  patchProps/events/文本元素；server-renderer 的 vnode 渲染；
  **jsx-core.test.tsx（21 用例）作为 JSX 冒烟基线**；
- **删除**：所有 `template:` 用例（模板编译产物形态，如 `<!---->` 占位）、
  slots / KeepAlive / Suspense / Teleport / Transition / v-model / block
  相关用例、vue e2e（浏览器 + 编译）；
- **修正为 fork 契约**：断言 `props.children` 而非 `children` 字段；
  共享 props 对象的用例需浅拷贝（children 写回 props 的副作用）；
- **gate**：`pnpm test-unit`（unit + unit-jsdom + unit-gc 三项目）、
  `pnpm test-jsx`（packages-jsx，exclude auto-define 测试）、
  `pnpm test-auto-define`（独立 babel 管线）、双 tsc（root + packages-jsx）、
  eslint。当前状态：unit 1504 passed / jsx 89 / auto-define 9。

---

## 10. 已知取舍与后续方向

- 元素级更新失去编译期精确性：大量"静态模板"场景全量 diff 成本高于上游
  block 模式（本 fork 无模板场景，属预期）；
- 单通道 children 意味着无具名插槽——多区域布局需改为显式传 props
  （如 `header`/`footer` 各传一个函数）或组件拆分；
- `shared/src/patchFlags.ts` 与 `slotFlags.ts` 目前只作为类型/历史导出保留，
  可进一步删除；
- 后续可选：基于 JSX 的属性静态分析（类似 React Compiler 方向）重新引入
  编译期优化，此时 VNode 无需回退双轨——优化只作用于纯函数形态。
