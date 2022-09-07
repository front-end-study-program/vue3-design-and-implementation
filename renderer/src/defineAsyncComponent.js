import { ref, onUnmounted, shallowRef } from 'vue'

/**
 * 异步高阶组件
 * @param {
 *  loader,
 *  timeout,
 *  errorComponent,
 *  delay = 200,
 *  loadingComponent,
 *  onError
 * } options
 * @returns
 */
export function defineAsyncComponent(options) {
  // 可以传递一个加载配置项或者加载器
  if (typeof options === 'function') {
    options = {
      loader: options
    }
  }

  const { loader } = options

  // 存储异步加载的组件
  let InnerComp = null

  // 重试次数
  let retries = 0
  function load() {
    return loader().catch(e => {
      if (options.onError) {
        return new Promise((res, rej) => {
          const retry = () => {
            res(load())
            retries++
          }
          const fail = () => rej(e)
          options.onError(retry, fail, retries)
        })
      } else {
        throw e
      }
    })
  }

  // 返回一个包装组件
  return {
    name: 'AsyncComponentWrapper',
    setup() {
      // 异步组件是否加载成功
      const loaded = ref(false)

      // 是否正在加载中
      const loading = ref(false)

      let loadingTimer = null
      if (options.delay) {
        loadingTimer = setTimeout(() => {
          loading.value = true
        }, options.delay)
      } else {
        loading.value = false
      }

      // 错误对象
      const error = shallowRef(null)

      load()
        .then(c => {
          InnerComp = c
          loaded.value = true
        })
        .catch(e => {
          error.value = e
        })
        .finally(() => {
          loading.value = false
          clearTimeout(loadingTimer)
        })

      let timer = null
      if (options.timeout) {
        timer = setTimeout(() => {
          const err = new Error(
            `Async component timed out after ${options.timeout}ms.`
          )
          error.value = err
        }, options.timeout)
      }

      onUnmounted(() => clearTimeout(timer))

      const placeholder = { type: Text, children: '' }

      return () => {
        if (loaded.value) {
          return { type: InnerComp }
        } else if (error.value && options.errorComponent) {
          return { type: options.errorComponent, props: { error: error.value } }
        } else if (loading.value && options.loadingComponent) {
          return { type: options.loadingComponent }
        }
        return placeholder
      }
    }
  }
}
