// 初版 effect

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
  // console.log(activeEffect, 'track', key, deps)
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if(!depsMap) return
  const effects = depsMap.get(key)

  effects && effects.forEach(fn => fn())
}

let activeEffect = null

function effect(fn) {
  activeEffect = fn
  fn()
}

effect(() => {
  console.log('执行了', proxyObj.ok ? proxyObj.text : 'not')
})


setTimeout(() => {
  proxyObj.ok = false
  proxyObj.text = 'world'
}, 1000)