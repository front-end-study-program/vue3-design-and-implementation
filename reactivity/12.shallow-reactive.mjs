// 浅响应与深响应

const ITERATE_KEY = Symbol()

const targetMap = new WeakMap()

function track(target, key) {
  if (!activeEffect) return
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

function trigger(target, key, type) {
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

export function effect(fn, options = {}) {
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

// isShallow 为 true 代表是浅层响应
function createReactive(obj, isShallow = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if(key === 'raw') {
        return target
      }

      track(target, key)
      const res = Reflect.get(target, key, receiver)

      // 浅响应，直接返回原始值
      if(isShallow) {
        return res
      }

      // 访问的时深层的key，如果这个key的值是一个对象的话，需要再次进行响应式化。
      // 因为 Reflect.get(target, key, receiver) 会返回一个不是代理的普通对象
      if(typeof res === 'object' && res !== null) {
        return reactive(res)
      }
      
      return res
    },
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    set(target, key, newValue, receiver) {
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      const oldValue = target[key]
      const result = Reflect.set(target, key, newValue, receiver)

      if(target === receiver.raw) {
        if(newValue !== oldValue && (oldValue === oldValue || newValue === newValue)) {
          trigger(target, key, type)
        }
      }
      return result
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)
      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
  
      return res
    }
  })
}


export function reactive(obj) {
  return createReactive(obj)
}
const obj = reactive({ foo: { bar: 1 } })
effect(() => {
  console.log(obj.foo.bar)
})

obj.foo.bar = 2


function shallowReactive(obj) {
  return createReactive(obj, true)
}

const shallowObj = shallowReactive({ foo: { bar: 1 } })
effect(() => {
  console.log('shallowObj', shallowObj.foo.bar)
})

shallowObj.foo.bar = 2