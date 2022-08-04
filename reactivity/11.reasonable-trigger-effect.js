// 合理触发响应

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


function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过 raw 属性访问原始数据
      if(key === 'raw') {
        return target
      }

      track(target, key)
      return Reflect.get(target, key, receiver)
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

      // target === receiver.raw 说明 receiver 就是 target 的代理对象
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

const obj = {}
const proto = { bar: 1 }

const child = reactive(obj)
const parent = reactive(proto)

Object.setPrototypeOf(child, parent)

effect(() => {
  console.log(child.bar)
})

child.bar = 2