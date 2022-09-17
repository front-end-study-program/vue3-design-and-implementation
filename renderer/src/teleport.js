export const Teleport = {
  __isTeleport: true,
  process(n1, n2, container, anchor, internals) {
    // 渲染器传递出来的内部方法
    const { patch, patchChildren, move } = internals
    if (!n1) {
      // 挂载
      const target =
        typeof n2.props.to === 'string'
          ? document.querySelector(n2.props.to)
          : n2.props.to
      // 挂载子节点
      n2.children.forEach(c => patch(null, c, target, anchor))
    } else {
      // 更新
      patchChildren(n1, n2, container)
      // 根据 Teleport 组件的 to 参数的值不同，需要对子内容进行一个移动
      if (n2.props.to !== n1.props.to) {
        const newTarget =
          typeof n2.props.to === 'string'
            ? document.querySelector(n2.props.to)
            : n2.props.to
        // 移动到新的容器
        n2.children.forEach(c => move(c, newTarget))
      }
    }
  }
}
