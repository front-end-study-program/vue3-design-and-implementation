// 只读和浅只读

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

// isReadonly 为true，代表只读
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if(key === 'raw') {
        return target
      }

      // 非只读的时候才需要建立依赖收集
      if(!isReadonly) {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)

      if(isShallow) {
        return res
      }

      if(typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : createReactive(res)
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
      if(isReadonly) {
        console.warn(`target is readonly`)
        return true
      }
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


function readonly(obj) {
  return createReactive(obj, false, true)
}

const readonlyObj = readonly({
  a: 1,
  foo: {
    bar: 3
  }
})

effect(() => {
  console.log('effect', readonlyObj.foo.bar)
})

readonlyObj.a = 2

readonlyObj.foo.bar = 4


function shallowReadonly(obj) {
  return createReactive(obj, true, true)
}

const shallowReadonlyObj = shallowReadonly({
  a: 1,
  foo: {
    bar: 3
  }
})

effect(() => {
  console.log('effect2', shallowReadonlyObj.foo.bar)
})

shallowReadonlyObj.a = 2
shallowReadonlyObj.foo.bar = 4