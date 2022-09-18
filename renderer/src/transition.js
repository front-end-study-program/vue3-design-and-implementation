const nextFrame = callback => {
  requestAnimationFrame(() => requestAnimationFrame(callback))
}

export const Transition = {
  name: 'Transition',
  setup(props, { slots }) {
    return () => {
      // 获取插槽需要过渡的元素
      const innerVNode = slots.default()

      innerVNode.transition = {
        beforeEnter(el) {
          el.classList.add('enter-from')
          el.classList.add('enter-active')
        },
        enter(el) {
          // 在下一帧切换到结束状态
          nextFrame(() => {
            el.classList.remove('enter-from')
            el.classList.add('enter-to')
            el.addEventListener('transitionend', () => {
              el.classList.remove('enter-to')
              el.classList.remove('enter-active')
            })
          })
        },
        leave(el, performRemove) {
          el.classList.add('leave-from')
          el.classList.add('leave-active')
          // 强制重绘
          nextFrame(() => {
            el.classList.remove('leave-from')
            el.classList.add('leave-to')
            el.addEventListener('transitionend', () => {
              el.classList.remove('leave-to')
              el.classList.remove('leave-active')
              performRemove()
            })
          })
        }
      }
    }
  }
}
