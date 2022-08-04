// 迭代器方法
// for...of entries() keys() values()

const ITERATE_KEY = Symbol();

const targetMap = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

function trigger(target, key, type, newValue) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);

  const effectsToRun = new Set();
  effects &&
    effects.forEach((effect) => {
      if (effect !== activeEffect) {
        effectsToRun.add(effect);
      }
    });
  
  if((type === 'ADD' || type === 'DELETE') && Object.prototype.toString.call(target) === '[object Map]') {
    const iterateEffects = depsMap.get(MAP_KEY_ITERATOR);
    iterateEffects && iterateEffects.forEach(effectFn => {
      if(effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  if (
    type === "ADD" ||
    type === "DELETE" ||
    (type === "SET" &&
      Object.prototype.toString.call(target) === "[object Map]")
  ) {
    const iterateEffects = depsMap.get(ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  }

  if (type === "ADD" && Array.isArray(target)) {
    const lengthEffects = depsMap.get("length");
    lengthEffects &&
      lengthEffects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  }

  if (Array.isArray(target) && key === "length") {
    depsMap.forEach((effects, key) => {
      if (key >= newValue) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

let activeEffect = null;

const effectStack = [];

function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    const res = fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };
  effectFn.options = options;
  effectFn.deps = [];

  if (!options.lazy) {
    effectFn();
  }

  return effectFn;
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }

  effectFn.deps.length = 0;
}

const reactiveMap = new Map();

function reactive(obj) {
  const existenceProxy = reactiveMap.get(obj);
  if (existenceProxy) return existenceProxy;

  const proxy = createReactive(obj);

  reactiveMap.set(obj, proxy);
  return proxy;
}

// 重写方法
const mutableInstrumentations = {
  forEach(callback, thisArg) {
    // wrap 函数用来把可代理的值转换为响应式数据
    const wrap = (val) => (typeof val === "object" ? reactive(val) : val);
    // 取得原始对象
    const target = this.raw;
    // 与 ITERATE_KEY 建立响应联系
    track(target, ITERATE_KEY);
    target.forEach((v, k) => {
      callback.call(thisArg, wrap(v), k, target);
    });
  },
  set(key, value) {
    const target = this.raw;
    const had = target.has(key);
    const oldValue = target.get(key);
    const rawValue = value.raw || value;
    target.set(key, rawValue);
    if (!had) {
      trigger(target, key, "ADD");
    } else if (
      value !== oldValue ||
      (oldValue === oldValue && value === value)
    ) {
      trigger(target, key, "SET");
    }
  },
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod,
  keys: keysIterationMethod,
};

function iterationMethod() {
  const target = this.raw;
  const itr = target[Symbol.iterator]();

  const wrap = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;

  track(target, ITERATE_KEY);

  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}

function valuesIterationMethod() {
  const target = this.raw;
  const itr = target.values();

  const wrap = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;

  track(target, ITERATE_KEY);

  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: wrap(value),
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}

const MAP_KEY_ITERATOR = Symbol();

function keysIterationMethod() {
  const target = this.raw;
  const itr = target.keys();

  const wrap = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;

  track(target, MAP_KEY_ITERATOR);

  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: wrap(value),
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === "raw") return target;
      if (key === "size") {
        track(target, ITERATE_KEY);
        return Reflect.get(target, key, target);
      }

      return mutableInstrumentations[key];
    },
  });
}

// const p = reactive(new Map([
//   ['key1', 'value1'],
//   ['key2', 'value2']
// ]))

// effect(() => {
//   for (const [key, value] of p) {
//     console.log(key, value)
//   }
// })

// p.set('key3', 'value3')

// const p = reactive(
//   new Map([
//     ["key1", "value1"],
//     ["key2", "value2"],
//   ])
// );

// effect(() => {
//   for (const [key, value] of p.entries()) {
//     console.log(key, value);
//   }
// });

// p.set("key3", "value3");

const p = reactive(
    new Map([
      ["key1", "value1"],
      ["key2", "value2"],
    ])
  );
  
  effect(() => {
    for (const key of p.keys()) {
      console.log(key);
    }
  });
  
  p.set("key3", "value3");
  p.set("key3", "value4");