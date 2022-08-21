// case：代理数组

// 存储副作用函数的桶
const bucket = new WeakMap();

const ITERATE_KEY = Symbol();
const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

// 重写 include 方法
const arrayInstrumentations = {};

["includes", "indexOf", "lastIndexOf"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    // this 是代理对象，先在代理对象中查找，结果存储到 res 中
    let res = originMethod.apply(this, args);

    if (res === false) {
      // 说明查不到，通过this.raw 拿到原始数组。再去其中查找并且更新 res 值
      res = originMethod.apply(this.raw, args);
    }
    return res;
  };
});

let shouldTrack = true;
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    shouldTrack = false;
    // push 方法的默认行为
    const res = originMethod.apply(this, args);
    shouldTrack = true; 
    return res;
  }
})

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截读取操作
    get(target, key, receiver) {
      if (key === "raw") {
        return target;
      }
      // 如果操作的目标是对象数组，并且 key 存在于 arrayInstrumentations 上，
      // 那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

      if (!isReadonly && typeof key !== "symbol") {
        track(target, key);
      }

      const res = Reflect.get(target, key, receiver);
      // 如果是浅响应，则直接返回原始值
      if (isShallow) {
        return res;
      }
      if (typeof res === "object" && res !== null) {
        // 将结果包装成响应式并返回
        // 深只读
        return isReadonly ? readonly(res) : reactive(res);
      }
      return res;
    },
    // 拦截写入操作
    set(target, key, newVal, receiver) {
      // 如果是 readonly, 则直接返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      // 先获取到旧值
      const oldVal = target[key];
      // 如果属性不存在，则说明是添加新的属性，否则是设置已有属性
      const type = Array.isArray(target)
        ? Number(key) < target.length // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);
      // target === raw 说明 receiver 就是target 的代理对象
      if (target === receiver.raw) {
        // 比较新旧值，只有不相等，且不都是 NAN 的时候才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 如果值发生变化，才触发
          // 增加第四个参数，即触发响应的新的值
          trigger(target, key, type, newVal);
        }
      }
      return res;
    },
    ownKeys(target) {
      // 将副作用和 ITERATE_KEY 进行关联
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    deleteProperty(target, key) {
      // 如果是只读， 打印警告信息返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      // 检查被操作的属性是否是自己对象的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);

      if (res && hadKey) {
        // 只有当被删除的属性是对象自己的属性且删除成功时，才触发
        trigger(target, key, TriggerType.DELETE);
      }
    },
  });
}

const reactiveMap = new Map();

function reactive(obj) {
  // 优先同姑姑原始对象 obj 寻找之前创建的代理对象，如果找到了，字节返回已有的带来代理对象
  const existProxy = reactiveMap.get(obj);
  if (existProxy) {
    return existProxy;
  }
  // 否则创建新的代理对象
  const proxy = createReactive(obj);
  reactiveMap.set(obj, proxy);
  return proxy;
}

function shallowReactive(obj) {
  return createReactive(obj, true);
}

function readonly(obj) {
  return createReactive(obj, false, true /* 只读 */);
}

function track(target, key) {
  // 没有 activeEffect 则直接 return
  if (!activeEffect || !shouldTrack) return;
  // 根据target从桶中取得 depsMap，也是一个 Map 类型：key --> effects
  let depsMap = bucket.get(target);
  // 如果不存在 depsMap，就新建一个 Map 并和 target 关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  // 根据 key 从 depsMap 中取得 deps, 也是一个 Set 类型
  // 里面存储着所有与当前 key 相关联的副作用函数： effects
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

function trigger(target, key, type, newVal) {
  // 获得对应key的effect set
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);

  // 临时的 set
  const effectsToRun = new Set(effects);
  // 将副作用函数 effect 取出并执行
  effects &&
    effects.forEach((effect) => {
      // 如果trigger触发的副作用函数和当前正在执行的函数相同，则跳过
      if (effect !== activeEffect) {
        effectsToRun.add(effect);
      }
    });

  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    // 取得与 ITERATE_KEY 相关联的 effect 副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    // 将 ITERATE_KEY 相关联的副作用函数也添加到 EffectsToRun
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 但操作类型是 Add 且 target 是数组是，取出并执行与 length 属性相关联的副作用函数
  if (type === TriggerType.ADD && Array.isArray(target)) {
    const lengthEffects = depsMap.get("length");
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 如果操作的 target 是数组，并且修改了数组的 length 属性
  if (Array.isArray(target) && key === "length") {
    // 对于索引大于或等于新的 length 值的元素，将所有相关联的副作用函数取出并切添加到 effectToRun 中执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if (effectFn?.options?.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

function cleanup(effectFn) {
  // 遍历 effectFn.deps 数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i];
    // 将 effectFn 从 deps 中移除
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

// 定义一个全局变量存储被注册的副作用函数
let activeEffect;
const effectStack = []; // 存储嵌套的副作用函数

function effect(fn, options = {}) {
  const effectFn = () => {
    // 调用 cleanup 完成清除工作
    cleanup(effectFn);
    // effectFn 执行是，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    effectStack.push(effectFn);
    // 将 fn 的执行结果存储到 res 中
    fn();
    // 调用完副作用函数后，将副作用函数出栈
    effectStack.pop();
    // 并将 activeEffect 设置为上一个激活的副作用函数
    activeEffect = effectStack[effectStack.length - 1];
  };
  // 将 option 挂载到 effectFn 上
  effectFn.options = options;
  effectFn.deps = [];
  effectFn();
}

// const arr = reactive(["foo"]);

// effect(() => {
//   console.log(arr[0]);
// });

// arr.length = 0

// const arr = reactive([1,2,3,4,5])
// effect(() => {
//   for (const val of arr) {
//     console.log(val);
//   }
// });

// arr[1] = 'bar'; // 能够触发响应
// arr.length = 0; // +1

// const obj = {};
// const arr = reactive([obj]);

// console.log(arr.includes(arr[0]));


const arr = reactive([]);
effect(() => {
  arr.push(1);
});

effect(() => {
  arr.push(2);
})

console.log(arr);