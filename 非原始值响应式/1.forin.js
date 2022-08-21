// case：for...in 代理

// 定义一个任务队列
const jobQueue = new Set();
// 使用 Promise.resolve 创建一个 promise 实例，用它将任务添加到微任务队列
const p = Promise.resolve();

// 一个标志代表是否正在刷新队列
let isFlushing = false;
function flushJob() {
  // 如果队列正在刷新，则什么也不做
  if (isFlushing) return;
  // 将 isFlushing 设置为 true，代表正在刷新
  isFlushing = true;
  // 将 jobQueue 中的任务取出，并执行
  p.then(() => {
    jobQueue.forEach((job) => job);
  }).finally(() => {
    // 结束后重置 isFlushing
    isFlushing = false;
  });
}

// 存储副作用函数的桶
const bucket = new WeakMap();

// 原始数据
const data = { foo: 1, bar: 2 };
const ITERATE_KEY = Symbol();
const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

// 对原始的数据进行代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key, receiver) {
    track(target, key);
    return Reflect.get(target, key, receiver);
  },
  // 拦截写入操作
  set(target, key, newVal, receiver) {
    // 如果属性不存在，则说明是添加新的属性，否则是设置已有属性
    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? TriggerType.SET
      : TriggerType.ADD;
    // 设置属性值
    const res = Reflect.set(target, key, newVal, receiver);
    trigger(target, key, type);
    return res;
  },
  ownKeys(target) {
    // 将副作用和 ITERATE_KEY 进行关联
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  },
  deleteProperty(target, key) {
    // 检查被操作的属性是否是自己对象的属性
    const hadKey = Object.prototype.hasOwnProperty.call(target, key);
    const res = Reflect.deleteProperty(target, key);

    if (res && hadKey) {
      // 只有当被删除的属性是对象自己的属性且删除成功时，才触发
      trigger(target, key, TriggerType.DELETE);
    }
  },
});

function track(target, key) {
  // 没有 activeEffect 则直接 return
  if (!activeEffect) return target[key];
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

function trigger(target, key, type) {
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

// 执行副作用函数，触发读取
effect(() => {
  for (let key in obj) {
    console.log(key);
  }
});

obj.new = 'new';
