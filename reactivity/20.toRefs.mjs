// toRefs 实现过程
/**
 * 1.解构代理对象响应丢失问题 -- toRefs
 * 2.解包 Ref -- proxyRefs
 */

import { reactive, effect } from './12.shallow-reactive.mjs'


function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
    set value(val) {
      obj[key] = val
    }
  }

  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })

  return wrapper
}

function toRefs(obj) {
  let ret = {}
  for (const key in obj) {
    ret[key] = toRef(obj, key)
  }
  return ret
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      return value.__v_isRef ? value.value : value
    },
    set(target, key, newValue, receiver) {
      const value = target[key]
      if (value && value.__v_isRef) {
        value.value = newValue
        return true
      }
      return Reflect.set(target, key, newValue, receiver)
    }
  })
}

const obj = reactive({ foo: 1, bar: 2 })

const newObj = proxyRefs({ ...toRefs(obj) })

effect(() => {
  console.log(newObj.foo, 'effect')
})

obj.foo = 2