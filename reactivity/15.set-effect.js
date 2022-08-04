// Set 的响应方案
/**
 * 1.解决代理对象调用 size 属性报错
 * 2.解决代理对象调用 Set 原型方法报错
 * 3.Set add 和 delete 方法需要触发size属性收集的副作用函数
 */

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
  add(key) {
    const target = this.raw
    const hadKey = target.has(key)
    if(!hadKey) {
      const res = target.add(key)
      trigger(target, key, 'ADD', res)
      return res
    }
  },
  delete(key) {
    const target = this.raw
    const hadKey = target.has(key)
    if(hadKey) {
      const res = target.delete(key)
      trigger(target, key, 'DELETE')
      return res
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

const p = reactive(new Set([1, 2, 3]))

effect(() => {
  console.log(p.size, p)
})

p.add(4)
p.delete(2)