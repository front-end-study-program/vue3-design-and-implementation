import {
  effect,
  ref,
  reactive,
  shallowReactive,
  shallowReadonly
} from '@vue/reactivity'

// 文本节点
const Text = Symbol('text')

// 注释节点
const Comment = Symbol('comment')

// 虚拟节点
const Fragment = Symbol('fragment')

function getSequence(arr) {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}

// 任务缓存队列
const queue = new Set()
// 是否正在刷新任务队列
let isFlushing = false
const p = Promise.resolve()
function queueJob(job) {
  queue.add(job)
  if (!isFlushing) {
    isFlushing = true
    p.then(() => {
      try {
        queue.forEach(job => job())
      } finally {
        isFlushing = false
        queue.length = 0
      }
    })
  }
}

function shouldSetAsProps(el, key, value) {
  if (key === 'form' && el.tagName === 'INPUT') return false
  return key in el
}

function createRenderer(options) {
  const {
    createElement,
    setElementText,
    insert,
    createText,
    setText,
    createComment,
    setComment,
    patchProps
  } = options

  function patchElement(n1, n2) {
    const el = (n2.el = n1.el)
    const oldProps = n1.props
    const newProps = n2.props

    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }

    patchChildren(n1, n2, el)
  }

  function patchChildren(n1, n2, container) {
    if (typeof n2.children === 'string') {
      // 文本新节点
      if (Array.isArray(n1.children)) {
        n1.children.forEach(c => unmount(c))
      }
      setElementText(container, n2.children)
    } else if (Array.isArray(n2.children)) {
      // 一组新节点
      if (Array.isArray(n1.children)) {
        // 普通 Diff 算法
        // ordinaryKeyedDiff(n1, n2, container)

        // 双端 Diff 算法
        // doubleEndedKeyedChildren(n1, n2, container)

        // 快速 Diff 算法
        fastKeyedChildren(n1, n2, container)
      } else {
        setElementText(container, '')
        n2.children.forEach(c => patch(null, c, container))
      }
    } else {
      // 不存在新节点
      if (Array.isArray(n1.children)) {
        n1.children.forEach(c => unmount(c))
      } else if (typeof n1.children === 'string') {
        setElementText(container, '')
      }
    }
  }

  // 普通 Diff 算法
  function ordinaryKeyedDiff(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    // 储存寻找过程中遇到的最大索引值
    let lastIndex = 0

    // 使用 key 来复用 DOM
    // eslint-disable-next-line for-direction
    for (let i = 0; i > newChildren.length; i++) {
      const newVNode = newChildren[i]
      let j = 0
      let find = false

      for (j; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]
        if (newVNode.key === oldVNode.key) {
          find = true
          patch(oldVNode, newVNode, container)
          if (j > lastIndex) {
            // 旧节点中小于最大索引值的节点需要移动
            const prevVNode = newChildren[i - 1]
            if (prevVNode) {
              const anchor = prevVNode.el.nextSibling
              insert(newVNode.el, container, anchor)
            }
          } else {
            lastIndex = j
          }
          break
        }
      }

      if (!find) {
        // 新增节点，无法匹配到旧节点中的 key
        const prevVNode = newChildren[i - 1]
        let anchor = null
        if (prevVNode) {
          anchor = prevVNode.el.nextSibling
        } else {
          anchor = container.firstChild
        }
        patch(null, newVNode, container, anchor)
      }
    }
    for (let i = 0; i < oldChildren.length; i++) {
      const oldVNode = oldChildren[i]
      const has = newChildren.find(vnode => vnode.key === oldVNode.key)
      if (!has) {
        unmount(oldVNode)
      }
    }
  }

  // 双端 Diff 算法
  function doubleEndedKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    // 四个索引
    let oldStartIdx = 0
    let oldEndIdx = oldChildren.length - 1
    let newStartIdx = 0
    let newEndIdx = newChildren.length - 1
    // 四个索引指向的虚拟节点
    let oldStartVNode = oldChildren[oldStartIdx]
    let oldEndVNode = oldChildren[oldEndIdx]
    let newStartVNode = newChildren[newStartIdx]
    let newEndVNode = newChildren[newEndIdx]

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (!oldStartVNode) {
        // 当双端比较没有匹配的时候进入 else 会找到旧节点数组中对应项操作后会置为 undefined
        oldStartVNode = oldChildren[++oldStartIdx]
      } else if (!oldEndVNode) {
        oldEndVNode = oldChildren[--oldEndIdx]
      } else if (oldStartVNode.key === newStartVNode.key) {
        patch(oldStartVNode, newStartVNode, container)
        oldStartVNode = oldChildren[++oldStartIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else if (oldEndVNode.key === newEndVNode.key) {
        // 无需移动，都是在最后
        patch(oldEndVNode, newEndVNode, container)
        oldEndVNode = oldChildren[--oldEndIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if (oldStartVNode.key === newEndVNode.key) {
        patch(oldStartVNode, newEndVNode, container)
        insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling)
        oldStartVNode = oldChildren[++oldStartIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if (oldEndVNode.key === newStartVNode.key) {
        patch(oldEndVNode, newEndVNode, container)
        insert(newStartVNode.el, container, oldStartVNode.el)

        oldEndVNode = oldChildren[--oldEndIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else {
        // 头尾节点都没有匹配到的情况
        const idxInOld = oldChildren.findIndex(
          node => node.key === newStartVNode.key
        )
        if (idxInOld > 0) {
          const vnodeToMove = oldChildren[idxInOld]
          patch(vnodeToMove, newStartVNode, container)
          insert(vnodeToMove.el, container, oldStartVNode.el)
          oldChildren[idxInOld] = undefined
          newStartVNode = newChildren[++newStartIdx]
        } else {
          // 新增节点
          patch(null, newStartVNode, container, oldStartVNode.el)
        }
        newStartVNode = newChildren[++newStartIdx]
      }
    }

    if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
      // 有新节点需要挂载
      for (let i = newStartIdx; i <= newEndIdx; i++) {
        patch(null, newChildren[i], container, oldStartVNode.el)
      }
    } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
      // 移除
      for (let i = oldStartIdx; i <= oldEndIdx; i++) {
        unmount(oldChildren[i])
      }
    }
  }

  // 快速 Diff 算法
  function fastKeyedChildren(n1, n2, container) {
    const newChildren = n1.children
    const oldChildren = n2.children

    // 预处理操作
    // 处理相同的前置节点
    let j = 0
    let oldVNode = oldChildren[j]
    let newVNode = newChildren[j]
    // while 循环向后遍历，直到遇到拥有不同 key 值的节点为止
    while (oldVNode.key === newVNode.key) {
      // patch 更新
      patch(oldVNode, newVNode, container)
      j++
      oldVNode = oldChildren[j]
      newVNode = newChildren[j]
    }

    // 处理相同的后置节点
    let oldEnd = oldChildren.length - 1
    let newEnd = newChildren.length - 1

    oldVNode = oldChildren[oldEnd]
    newVNode = newChildren[newEnd]
    // while 循环向前遍历，直到遇到拥有不同 key 值的节点为止
    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container)
      oldEnd--
      newEnd--
      oldVNode = oldChildren[oldEnd]
      newVNode = newChildren[newEnd]
    }

    // 预处理完前置节点和后置节点后剩余的其余新旧节点的处理
    if (j > oldEnd && j <= newEnd) {
      // j -> newEnd 为新增节点
      const anchorIndex = newEnd + 1
      const anchor =
        anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor)
      }
    } else if (j > newEnd && j <= oldEnd) {
      // j -> oldEnd 为卸载节点
      while (j <= oldEnd) {
        unmount(oldChildren[j++])
      }
    } else {
      // 非理性化，判断是否要移动节点
      // 构造 sources 数组
      const count = newEnd - j + 1
      const sources = new Array(count)
      sources.fill(-1)

      const oldStart = j
      const newStart = j
      let moved = false
      let pos = 0
      // 构建索引表，来优化嵌套 for 循环带来的消耗
      const keyIndex = {}

      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i]] = i
      }
      // 代表更新过的节点数量
      let patched = 0
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldChildren[i]
        if (patched <= count) {
          const k = keyIndex[oldVNode.key]
          if (typeof k !== 'undefined') {
            newVNode = newChildren[k]
            patch(oldVNode, newVNode, container)
            patched++
            sources[k - newStart] = i
            if (k < pos) {
              moved = true
            } else {
              pos = k
            }
          } else {
            unmount(oldVNode)
          }
        } else {
          unmount(oldVNode)
        }
      }

      if (moved) {
        // 需要移动节点
        const seq = getSequence(sources)

        let s = seq.length - 1
        let i = count - 1
        for (i; i >= 0; i--) {
          if (sources[i] === -1) {
            // 说明是全新的节点，应该将其挂载
            const pos = i + newStart
            const newVNode = newChildren[pos]
            const nextPos = pos + 1
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null
            patch(null, newVNode, container, anchor)
          } else if (i !== seq[s]) {
            // 该节点需要移动
            const pos = i + newStart
            const newVNode = newChildren[pos]
            const nextPos = pos + 1
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null
            insert(newVNode.el, container, anchor)
          } else {
            // 不需要移动
            s--
          }
        }
      }
    }
  }

  function patch(n1, n2, container, anchor) {
    if (n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }
    const { type } = n2
    if (typeof type === 'string') {
      // 普通标签
      if (!n1) {
        // 挂载
        mountElement(n2, container, anchor)
      } else {
        // 对比更新
        patchElement(n1, n2)
      }
    } else if (typeof type === 'object' && type.__isTeleport) {
      // Teleport 组件
      type.process(n1, n2, container, anchor, {
        patch,
        patchChildren,
        unmount,
        move(vnode, container, anchor) {
          insert(
            vnode.component ? vnode.component.subTree.el : vnode.el,
            container,
            anchor
          )
        }
      })
    } else if (typeof type === 'object' || typeof type === 'function') {
      // 组件
      if (!n1) {
        // 挂载组件
        // 如果该组件已经被 keepAlive 则不会重新挂载它，而是会调用 _activate 来激化
        if (n2.keptAlive) {
          n2.keepAliveInstance._activate(n2, container, anchor)
        } else {
          mountComponent(n2, container, anchor)
        }
      } else {
        // 更新组件
        patchComponent(n1, n2, anchor)
      }
    } else if (type === Text) {
      // 文本节点
      if (!n1) {
        const el = (n2.el = createText(n2.children))
        insert(container, el)
      } else {
        const el = (n2.el = n1.el)
        if (n2.children !== n1.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === Comment) {
      // 注释节点
      if (!n1) {
        const el = (n2.el = createComment(n2.children))
        insert(container, el)
      } else {
        const el = (n2.el = n1.el)
        if (n2.children !== n1.children) {
          setComment(el, n2.children)
        }
      }
    } else if (type === Fragment) {
      // 虚拟节点
      if (!n1) {
        n2.children.forEach(c => patch(null, c, container))
      } else {
        patchChildren(n1, n2, container)
      }
    }
  }

  function mountElement(vnode, container, anchor) {
    const el = (vnode.el = createElement(vnode.type))

    // 设置标签属性，区分 HTML attribute 和 DOM properties
    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }

    if (typeof vnode.children === 'string') {
      // 文本子节点
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      // 数组递归调用 patch 进行补丁操作
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }

    insert(el, container, anchor)
  }

  function unmount(vnode) {
    if (vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    } else if (typeof vnode.type === 'object') {
      if (vnode.shouldKeepAlive) {
        // keepAlive 组件，卸载时将其移动到隐藏容器，不进行真的卸载操作
        vnode.keepAliveInstance._deActivate(vnode)
      }
      unmount(vnode.component.subTree)
      return
    }
    const parent = vnode.el.parentNode
    if (parent) {
      parent.removeChild(vnode.el)
    }
  }

  let currentInstance = null
  function setCurrentInstance(instance) {
    currentInstance = instance
  }

  function onMounted(fn) {
    if (currentInstance) {
      currentInstance.mounted.push(fn)
    } else {
      console.error('onMounted 函数只能再 setup 中调用')
    }
  }

  // 挂载组件
  function mountComponent(vnode, container, anchor) {
    const isFunctional = typeof vnode.type === 'function'

    let componentOptions = vnode.type

    if (isFunctional) {
      // 函数式组件
      componentOptions = {
        render: vnode.type,
        props: vnode.type.props
      }
    }
    let {
      render,
      data,
      setup,
      props: propsOption,
      beforeCreate,
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated
    } = componentOptions

    beforeCreate && beforeCreate()

    // 包装成响应式数据
    const state = data ? reactive(data()) : null
    const [props, attrs] = resolveProps(propsOption, vnode.props)

    // 插槽处理
    const slots = vnode.children || {}

    // 组件实例
    const instance = {
      state,
      props: shallowReactive(props),
      isMounted: false,
      subTree: null,
      slots,
      mounted: [],
      keepAliveCtx: null // keepAlive 专用组件
    }

    // 当前组件是否是 keepAlive 组件
    const isKeepAlive = vnode.type.__isKeepAlive
    if (isKeepAlive) {
      instance.keepAliveCtx = {
        move(vnode, container, anchor) {
          insert(vnode.component.subTree.el, container, anchor)
        },
        createElement
      }
    }
    // 自定义事件处理
    function emit(event, ...payload) {
      const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
      const handler = instance.props[eventName]
      if (handler) {
        handler(...payload)
      } else {
        console.error('事件不存在')
      }
    }

    // 处理 setup 逻辑
    const setupContext = {
      attrs,
      emit,
      slots
    }

    // 设置当前组件实例
    setCurrentInstance(instance)
    const setupResult = setup(shallowReadonly(instance.props), setupContext)
    setCurrentInstance(null)
    // 存储 setup 返回的数据
    let setupState = null
    if (typeof setupResult === 'function') {
      if (render) console.error('setup 函数返回渲染函数，render 选项将被忽略')
      render = setupResult
    } else {
      setupState = setupResult
    }

    vnode.component = instance

    // 渲染上下文
    const renderContext = new Proxy(instance, {
      get(t, k) {
        const { state, props, slots } = t
        if (k === '$slots') return slots
        if (state && k in state) {
          return state[k]
        } else if (k in props) {
          return props[k]
        } else if (setupState && k in setupState) {
          return setupState[k]
        } else {
          // 不存在
          console.error('不存在')
        }
      },
      set(t, k, v) {
        const { state, props } = t
        if (state && k in state) {
          state[k] = v
        } else if (k in props) {
          props[k] = v
        } else if (setupState && k in setupState) {
          setupState[k] = v
        } else {
          // 不存在
          console.error('不存在')
        }
      }
    })

    created && created.call(renderContext)

    effect(
      () => {
        // 改变 this 指向
        const subTree = render.call(renderContext, renderContext)

        if (!instance.isMounted) {
          // 初次挂载
          beforeMount && beforeMount.call(renderContext)
          patch(null, subTree, container, anchor)
          instance.isMounted = true
          mounted && mounted.call(renderContext)
          instance.mounted.forEach(hook => hook.call(renderContext))
        } else {
          beforeUpdate && beforeUpdate.call(renderContext)
          patch(instance.subTree, subTree, container, anchor)
          updated && updated.call(renderContext)
        }

        instance.subTree = subTree
      },
      {
        scheduler: queueJob
      }
    )
  }

  // 更新组件
  function patchComponent(n1, n2, anchor) {
    const instance = (n2.component = n1.component)
    const { props } = instance
    if (hasPropsChanged(n1.props, n2.props)) {
      const [nextProps] = resolveProps(n2.type.props, n2.props)
      for (const k in nextProps) {
        props[k] = nextProps[k]
      }
      for (const k in props) {
        if (!(k in nextProps)) delete props[k]
      }
    }
  }

  function hasPropsChanged(prevProps, nextProps) {
    const nextKeys = Object.keys(nextProps)
    if (nextKeys.length !== Object.keys(prevProps).length) {
      return true
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i]
      if (nextProps[key] !== prevProps[key]) return true
    }
    return false
  }

  function resolveProps(options, propsData) {
    const props = {}
    const attrs = {}
    for (const key in propsData) {
      if (key in options || key.startsWith('on')) {
        // 使用组件的地方传递过来的属性
        props[key] = propsData[key]
      } else {
        attrs[key] = propsData[key]
      }
    }

    return [props, attrs]
  }

  function render(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        unmount(container._vnode)
      }
    }
    container._vnode = vnode
  }

  return {
    render
  }
}

const { render } = createRenderer({
  createElement(tag) {
    return document.createElement(tag)
  },
  setElementText(el, text) {
    el.textContent = text
  },
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  createText(text) {
    return document.createTextNode(text)
  },
  setText(el, text) {
    el.nodeValue = text
  },
  createComment(text) {
    return document.createComment(text)
  },
  setComment(el, text) {
    el.nodeValue = text
  },
  patchProps(el, key, preValue, nextValue) {
    if (/^on/.test(key)) {
      const invokers = el._vei || (el._vei = {})
      // 事件处理
      let invoker = invokers[key]
      const name = key.slice(2).toLowerCase()
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[key] = e => {
            // 事件发生时间早于处理函数绑定事件时间，则不执行处理函数
            if (e.timeStamp < invoker.attached) return
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
            } else {
              invoker.value(e)
            }
          }
          invoker.value = nextValue
          invoker.attached = performance.now()
          el.addEventListener(name, invoker)
        } else {
          invoker.value = nextValue
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker)
      }
    } else if (key === 'class') {
      el.className = nextValue || ''
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 使用 DOM properties 设置属性
      const type = typeof key
      if (type === 'boolean' && nextValue === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      // HTML attribute
      el.setAttribute(key, nextValue)
    }
  }
})

const bol = ref(false)

effect(() => {
  console.log('effect')
  const vnode = {
    type: 'div',
    props: bol.value
      ? {
          onClick() {
            alert('父元素 clicked')
          }
        }
      : {},
    children: [
      {
        type: 'p',
        props: {
          onClick() {
            bol.value = true
          }
        },
        children: '子元素'
      }
    ]
  }
  const MyComponent = {
    name: 'MyComponent',
    props: {
      title: {
        type: String,
        default: ''
      }
    },
    data() {
      return {
        foo: 'foo'
      }
    },
    render() {
      return {
        type: 'div',
        children: `foo is ${this.foo} value. title is ${this.title}`
      }
    }
  }
  render(vnode, document.querySelector('#app'))
})
