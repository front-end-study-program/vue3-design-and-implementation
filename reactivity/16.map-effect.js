// 避免污染原始数据

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

  if(type === 'ADD' && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach((effect) => {
      if(effect !== activeEffect) {
        effectsToRun.add(effect)
      }
    })
  }

  if(Array.isArray(target) && key === 'length') {
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

const reactiveMap = new Map()

function reactive(obj) {
  const existenceProxy = reactiveMap.get(obj)
  if(existenceProxy) return existenceProxy

  const proxy = createReactive(obj)

  reactiveMap.set(obj, proxy)
  return proxy
}

// 重写方法
const mutableInstrumentations = {
  get(key) {
    // 获取原始对象
    const target = this.raw
    // 判断读取的 key 是否存在
    const had = target.has(key)
    // 追踪依赖
    track(target, key)
    // 如果存在，则返回结果。如果得到的结果是一个对象，继续代理数据
    if(had) {
      const res = target.get(key)
      return typeof res === 'object' ? reactive(res) : res
    }
  },
  set(key, value) {
    const target = this.raw
    const had = target.has(key)
    const oldValue = target.get(key)
    const rawValue = value.raw || value
    target.set(key, rawValue)
    if(!had) {
      trigger(target, key, 'ADD')
    } else if(value !== oldValue || (oldValue === oldValue && value === value)) {
      trigger(target, key, 'SET')
    }
  }
}

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if(key === 'raw') return target
      if(key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }

      return mutableInstrumentations[key]
    }
  })
}


const p = reactive(new Map([['key', 1]]))


effect(() => {
  console.log(p.get('key'))
})


p.set('key', 2)