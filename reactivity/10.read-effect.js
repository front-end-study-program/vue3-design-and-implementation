// 不同方式读取/遍历对象的属性的拦截器方法

const obj = {
  foo: 1,
}

const ITERATE_KEY = Symbol()

var proxyObj = new Proxy(obj, {
  get(target, key, receiver) {
    track(target, key)
    return Reflect.get(target, key, receiver)
  },
  // 拦截 key in obj 操作
  has(target, key) {
    track(target, key)
    return Reflect.has(target, key)
  },
  // 拦截 for...in 操作
  ownKeys(target) {
    track(target, ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
  set(target, key, value, receiver) {
    // 只有新增加的 key 才需要触发 ITERATE_KEY 的副作用函数
    const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
    const result = Reflect.set(target, key, value, receiver)
    trigger(target, key, type)
    return result
  },
  // 拦截删除属性操作
  deleteProperty(target, key) {
    // 检查被操作的属性是否是对象自己的属性
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const res = Reflect.deleteProperty(target, key)
    if (res && hadKey) {
      trigger(target, key, 'DELETE')
    }

    return res
  }
})

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

  // 只有 type 为 ADD or DELETE 时，才触发 ITERATE_KEY 的副作用函数
  if(type === 'ADD' || type === 'DELETE') {
    // 取得 ITEM_KEY 属性的所有副作用函数
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


effect(() => {
  for(const key in proxyObj) {
    console.log(key)
  }
})

proxyObj.bar = 2

proxyObj.foo = 2