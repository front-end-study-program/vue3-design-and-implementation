let currentInstance = null

const keepAlive = {
  // 唯一标识
  __isKeepAlive: true,
  setup(props, { slots }) {
    // 创建一个缓存对象
    const cache = new Map()
    // 组件实例
    const instance = currentInstance
    // 对于 keepAlive 组件来说，它的实例上存在特殊的 keepAliveCtx 对象，该对象由渲染器注入
    // 该对象会暴露渲染器的一些内部方法，其中 move 函数用来将一段 DOM 移动到另一个容器中
    const { move, createElement } = instance.keepAliveCtx

    // 创建一个隐藏容器
    const storageContainer = createElement('div')

    // KeepAlive 组件的实例上会被添加两个内部函数，分别是 _deActivate 和 _activate
    // 这两个函数会在渲染器中被调用
    instance._deActivate = vnode => {
      move(vnode, storageContainer)
    }
    instance._activate = (vnode, container, anchor) => {
      move(vnode, container, anchor)
    }

    return () => {
      // keepAlive 的默认插槽就是要被缓存的组件
      let rawVnode = slots.default()
      // 如果不是组件，直接渲染，是无法被缓存的
      if (typeof rawVnode.type !== 'function') {
        return rawVnode
      }

      // 在挂载时先获取缓存的组件 vnode
      const cachedVnode = cache[rawVnode.type]
      if (cachedVnode) {
        // 存在缓存，则激活组件
        rawVnode.component = cachedVnode.component // 组件实例
        // 设置 keptAlive 避免渲染器重新挂载
        rawVnode.keptAlive = true
      } else {
        cache.set(rawVnode.type, rawVnode)
      }
      // 设置 shouldKeepAlive 属性，避免渲染器将组件卸载
      rawVnode.shouldKeepAlive = true
      // 将实例挂载在节点上，提供给渲染器访问
      rawVnode.keepAliveInstance = instance

      return rawVnode
    }
  }
}
