// 数组值的依赖收集和触发
/**
 * 1.设置和添加数组的值，使 length 属性发生改变
 * 2.设置数组 length属性，导致数组的元素被删除
 * 3.数组includes方法。访问的值是引用类型会继续创建代理对象，会导致includes中的参数和原对象不相等
 * 4.数组的includes方法。传入原始对象又和代理对象不相等
 * 5.indexOf 和 lastIndexOf 也需要和 includes 一样处理
 * 6.修改数组的原型方法，造成的 length 改变。push/pop/shift/unshift/splice等
 */

const ITERATE_KEY = Symbol()

const targetMap = new WeakMap()

function track(target, key) {
  if (!activeEffect || !shouldTrack) return
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, depsMap = new Map())
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, deps = new Set())
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)

}

function trigger(target, key, type, newValue) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)

  const effectsToRun = new Set()
  effects && effects.forEach((effect) => {
    if (effect !== activeEffect) {
      effectsToRun.add(effect)
    }
  })

  if(type === 'ADD' || type === 'DELETE') {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach((effect) => {
      if(effect !== activeEffect) {
        effectsToRun.add(effect)
      }
    })
  }

  // 如果是数组并且是 ADD 操作，则需要触发数组 length 所搜集的依赖
  if(type === 'ADD' && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach((effect) => {
      if(effect !== activeEffect) {
        effectsToRun.add(effect)
      }
    })
  }

  // 如果操作目标是数组并且修改了数组的length属性
  if(Array.isArray(target) && key === 'length') {
    // 对于索引大于或者等于 length 属性的元素
    // 需要把相关收集的副作用函数拿出来执行
    depsMap.forEach((effects, key) => {
      if(key >= newValue) {
        effects.forEach((effectFn) => {
          if(effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

let activeEffect = null

const effectStack = []

function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    const res = fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.options = options
  effectFn.deps = []

  if (!options.lazy) {
    effectFn()
  }

  return effectFn
}


function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }

  effectFn.deps.length = 0;
}

//重写数组的includes lastIndexOf indexOf 方法
const arrayInstrumentations = {}

;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {

    // 从代理对象上面去找
    let res = originMethod.apply(this, args)

    if(res === false) {
      // 找不到在从原始对象上面去找
      res = originMethod.apply(this.raw, args)
    }

    return res
  }
})

// 一个标记变量，代表是否进行追踪。默认值为 true，即允许追踪
let shouldTrack = true
// 重写 push 方法
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    shouldTrack = false
    const res = originMethod.apply(this, args)
    shouldTrack = true
    return res
  }
})

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if(key === 'raw') {
        return target
      }

      // 如果操作的目标对象是数组，并且 key 存在arrayInstrumentations上，
      // 那么返回定义在 arrayInstrumentations 上的值
      if(Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      // 使用 for...of 和 数组的 values 方法时会读取数组的 symbol.iterate 属性。导致建立依赖关系，浪费性能 
      if(!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)

      if(isShallow) {
        return res
      }

      if(typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }
      
      return res
    },
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      // 如果 for...in 遍历的是数组。改变数组的 length 也需要收集依赖
      track(target, Array.isArray(target) ? 'length' :ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    set(target, key, newValue, receiver) {
      if(isReadonly) {
        console.warn(`target is readonly`)
        return true
      }
      // 如果是数组，通过 key 与 数组长度做比较，如果 key 小于数组长度是 SET 操作，否则是 ADD 操作
      const type = Array.isArray(target)
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      const oldValue = target[key]
      const result = Reflect.set(target, key, newValue, receiver)

      if(target === receiver.raw) {
        if(newValue !== oldValue && (oldValue === oldValue || newValue === newValue)) {
          trigger(target, key, type, newValue)
        }
      }
      return result
    },
    deleteProperty(target, key) {
      if(isReadonly) {
        console.warn(`target is readonly`)
        return true
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)
      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
  
      return res
    }
  })
}

// 定义一个 Map 实例，用来存放原始对象和代理对象的映射
const reactiveMap = new Map()

function reactive(obj) {
  // 优先判断原始对象 obj 是否已经有对应的代理对象
  const existenceProxy = reactiveMap.get(obj)
  if(existenceProxy) return existenceProxy

  const proxy = createReactive(obj)

  reactiveMap.set(obj, proxy)
  return proxy
}

// const arr = reactive([1])

// effect(() => {
//   console.log('effect', arr.length)
// })

// arr[1] = 2


// effect(() => {
//   console.log(arr[0])
// })

// arr.length = 0


// effect(() => {
//   for (const key in arr) {
//     console.log(key)
//   }
// })

// arr.push(2)
// arr.length = 1

// const obj = {}
// const arr = reactive([obj])

// console.log(arr.includes(arr[0]))

// const obj = {}
// const arr = reactive([obj])

// console.log(arr.includes(obj))

const arr = reactive([])

effect(() => {
  arr.push(1)
})


effect(() => {
  arr.push(2)
})