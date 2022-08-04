// 避免执行分支语句中非进入条件的 effect 函数

var proxyObj = new Proxy({
  text: 'hello',
  ok: true
}, {
  get(target, key, receiver) {
    track(target, key)
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver)
    trigger(target, key)
    return result
  }
})

const targetMap = new WeakMap()

function track(target, key) {
  if(!activeEffect) return
  let depsMap = targetMap.get(target)
  if(!depsMap) {
    targetMap.set(target, depsMap = new Map())
  }

  let deps = depsMap.get(key)
  if(!deps) {
    depsMap.set(key, deps = new Set())
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)

  // console.log(activeEffect, 'track', key, deps)
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if(!depsMap) return
  const effects = depsMap.get(key)

  const effectsToRun = new Set(effects)
  effectsToRun.forEach(effectFn => effectFn())
}

let activeEffect = null

function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    fn()
  }
  effectFn.deps = []
  effectFn()
}

effect(() => {
  console.log(activeEffect, 'activeEffect1')
  setTimeout(() => {
    console.log('执行了', proxyObj.ok ? proxyObj.text : 'not')
    console.log(activeEffect, 'activeEffect2')
  }, 500)
})

// 解决问题方案
function cleanup(effectFn) {
  for(let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }

  effectFn.deps.length = 0;
}

setTimeout(() => {
  proxyObj.ok = false
  proxyObj.text = 'world'
}, 1000)