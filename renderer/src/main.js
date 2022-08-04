import { effect, ref } from '@vue/reactivity'

// 文本节点
const Text = Symbol()

// 注释节点
const Comment = Symbol()

// 虚拟节点
const Fragment = Symbol()

function shouldSetAsProps(el, key, value) {
  if(key === 'form' && el.tagName === 'INPUT') return false
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
    const el = n2.el = n1.el
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
    if(typeof n2.children === 'string') {
      // 文本新节点
      if(Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c))
      }
      setElementText(container, n2.children)
    } else if(Array.isArray(n2.children)) {
      // 一组新节点
      if(Array.isArray(n1.children)) {
        // 普通 Diff 算法
        // const oldChildren = n1.children
        // const newChildren = n2.children
        // // 储存寻找过程中遇到的最大索引值
        // let lastIndex = 0
        // // 使用 key 来复用 DOM
        // for(let i = 0; i> newChildren.length; i++) {
        //   const newVNode = newChildren[i]
        //   let j = 0
        //   let find = false

        //   for(j; j < oldChildren.length; j++) {
        //     const oldVNode = oldChildren[j]
        //     if(newVNode.key === oldVNode.key) {
        //       find = true
        //       patch(oldVNode, newVNode, container)
        //       if(j > lastIndex) {
        //         // 旧节点中小于最大索引值的节点需要移动
        //         const prevVNode = newChildren[i - 1]
        //         if(prevVNode) {
        //           const anchor = prevVNode.el.nextSibling
        //           insert(newVNode.el, container, anchor)
        //         }

        //       } else {
        //         lastIndex = j
        //       }
        //       break
        //     }
        //   }

        //   if(!find) {
        //     // 新增节点，无法匹配到旧节点中的 key
        //     const prevVNode = newChildren[i - 1]
        //     let anchor = null
        //     if(prevVNode) {
        //       anchor = prevVNode.el.nextSibling
        //     } else {
        //       anchor = container.firstChild
        //     }
        //     patch(null, newVNode, container, anchor)
        //   }
        // }
        // for(let i = 0; i < oldChildren.length; i++) {
        //   const oldVNode = oldChildren[i]
        //   const has = newChildren.find(vnode => vnode.key === oldVNode.key)
        //   if(!has) {
        //     unmount(oldVNode)
        //   }
        // }


        // 双端 Diff 算法
        patchKeyedChildren(n1, n2, container)




      } else {
        setElementText(container, '')
        n2.children.forEach((c) => patch(null, c, container))
      }
    } else {
      // 不存在新节点
      if(Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c))
      } else if(typeof n1.children === 'string') {
        setElementText(container, '')
      }
    }
  }

  // 双端 Diff 算法
  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    //四个索引
    let oldStartIdx = 0
    let oldEndIdx = oldChildren.length - 1
    let newStartIdx = 0
    let newEndIdx = newChildren.length - 1
    // 四个索引指向的虚拟节点
    let oldStartVNode = oldChildren[oldStartIdx]
    let oldEndVNode = oldChildren[oldEndIdx]
    let newStartVNode = newChildren[newStartIdx]
    let newEndVNode = newChildren[newEndIdx]

    while(oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if(!oldStartVNode) {
        // 当双端比较没有匹配的时候进入 else 会找到旧节点数组中对应项操作后会置为 undefined
        oldStartVNode = oldChildren[++oldStartIdx]
      } else if(!oldEndVNode) {
        oldEndVNode = oldChildren[--oldEndIdx]
      } else if(oldStartVNode.key === newStartVNode.key) {
        patch(oldStartVNode, newStartVNode, container)
        oldStartVNode = oldChildren[++oldStartIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else if(oldEndVNode.key === newEndVNode.key) {
        // 无需移动，都是在最后
        patch(oldEndVNode, newEndVNode, container)
        oldEndVNode = oldChildren[--oldEndIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if(oldStartVNode.key === newEndVNode.key) {
        patch(oldStartVNode, newEndVNode, container)
        insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling)
        oldStartVNode = oldChildren[++oldStartIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if(oldEndVNode.key === newStartVNode.key) {
        patch(oldEndVNode, newEndVNode, container)
        insert(newStartVNode.el, container, oldStartVNode.el)
  
        oldEndVNode = oldChildren[--oldEndIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else {
        // 都没有匹配到的情况
        const idxInOld = oldChildren.findIndex(node => node.key === newStartVNode.key)
        if(idxInOld > 0) {
          const vnodeToMove = oldChildren[idxInOld]
          patch(vnodeToMove, newStartVNode, container)
          insert(vnodeToMove.el, container, oldStartVNode.el)
          oldChildren[idxInOld] = undefined
          newStartVNode = newChildren[++newStartIdx]
        }
      }
    }
  }


  function patch(n1, n2, container, anchor) {
    if(n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }
    const { type } = n2
    if(typeof type === 'string') {
      // 普通标签
      if(!n1) {
        // 挂载
        mountElement(n2, container, anchor)
      } else {
        // 对比更新
        patchElement(n1, n2)
      }
    } else if(typeof type === 'object') {
      // 组件
    } else if(type === Text) {
      // 文本节点
      if(!n1) {
        const el = n2.el = createText(n2.children)
        insert(container, el)
      } else {
        const el = n2.el = n1.el
        if(n2.children !== n1.children) {
          setText(el, n2.children)
        }
      }
    } else if(type === Comment) {
      // 注释节点
      if(!n1) {
        const el = n2.el = createComment(n2.children)
        insert(container, el)
      } else {
        const el = n2.el = n1.el
        if(n2.children !== n1.children) {
          setComment(el, n2.children)
        }
      }
    } else if(type === Fragment) {
      // 虚拟节点
      if(!n1) {
        n2.children.forEach((c) => patch(null, c, container))
      } else {
        patchChildren(n1, n2, container)
      }
    }
    
  }

  function mountElement(vnode, container, anchor) {
    const el = vnode.el = createElement(vnode.type)

    // 设置标签属性，区分 HTML attribute 和 DOM properties
    if(vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }

    if(typeof vnode.children === 'string') {
      // 文本子节点
      setElementText(el, vnode.children)
    } else if(Array.isArray(vnode.children)) {
      // 数组递归调用 patch 进行补丁操作
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }

    insert(el, container, anchor)
  }

  function unmount(vnode) {
    if(vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    }
    const parent = vnode.el.parentNode
    if(parent) {
      parent.removeChild(el)
    }
  }

  function render(vnode, container) {
    if(vnode) {
      patch(container._vnode, vnode, container)
    } else {
      if(container._vnode) {
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
    if(/^on/.test(key)) {
      const invokers =  el._vei || (el._vei = {})
      // 事件处理
      let invoker = invokers[key]
      const name = key.slice(2).toLowerCase()
      if(nextValue) {
        if(!invoker) {
          invoker = el._vei[key] = (e) => {
            // 事件发生时间早于处理函数绑定事件时间，则不执行处理函数
            if(e.timeStamp < invoker.attached) return
            if(Array.isArray(invoker.value)) {
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
      } else if(invoker) {
        el.removeEventListener(name, invoker)
      }
    } else if(key === 'class') {
      el.className = nextValue || ''
    } else if(shouldSetAsProps(el, key, nextValue)) {
      // 使用 DOM properties 设置属性
      const type = typeof key
      if(type === 'boolean' && nextValue === '') {
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
    props: bol.value ? {
      onClick: () => {
        alert('父元素 clicked')
      }
    } : {},
    children: [
      {
        type: 'p',
        props: {
          onClick: () => {
            bol.value = true
          }
        },
        children: '子元素'
      }
    ]
  }
  render(vnode, document.querySelector('#app'))
})
