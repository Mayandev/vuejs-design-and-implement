// case：计算属性

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
// 对原始的数据进行代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    track(target, key);
    return target[key];
  },
  // 拦截写入操作
  set(target, key, newVal) {
    // 设置属性值ß
    target[key] = newVal;
    trigger(target, key);
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
  console.log(activeEffect.deps, key);
}

function trigger(target, key) {
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
  effectsToRun.forEach((effect) => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if (effect.options.scheduler) {
      effect.options.scheduler(effect);
    } else {
      effect();
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
    const res = fn();
    // 调用完副作用函数后，将副作用函数出栈
    effectStack.pop();
    // 并将 activeEffect 设置为上一个激活的副作用函数
    activeEffect = effectStack[effectStack.length - 1];
    // 将 res 作为 effectFn 的返回值
    return res;
  };
  // 将 option 挂载到 effectFn 上
  effectFn.options = options;
  effectFn.deps = [];
  if (!options.lazy) {
    // 执行副作用函数
    effectFn();
  }
  return effectFn;
}

// 执行副作用函数，触发读取
effect(
  () => {
    console.log(obj.foo, "obj.foo");
  },
  {
    scheduler(fn) {
      console.log("schedule...");
      // 每次调度，将副作用函数添加到 jobQueue 队列中
      jobQueue.add(fn);
      // 最终这里会等到副作用函数执行完后，即主线程执行完，之后会执行微任务，因此 flushJob 函数只会执行一次
      flushJob();
    },
  }
);

function computed(getter) {
  // value 用来缓存上一次计算的值
  let value;
  // dirty 标志
  let dirty = true;

  // 把 getter 作为副作用函数，创建一个 lazy 的 effect
  // scheduler 会在依赖的值更新后执行
  const effectFn = effect(getter, { lazy: true, scheduler() {
    if (!dirty) {
      dirty = true;
      // 但计算属性以来的响应式数据变化时，手动调用 trigger 函数触发响应
      trigger(obj, "value");
    }
  } });

  const obj = {
    // 但读取 value 时执行 effectFn
    get value() {
      // 只有 dirty 时才计算，并将得到的值缓存到 value 中
      if (dirty) {
        value = effectFn();
        // 将 dirty 设置为 false，下一次访问直接使用缓存到 value 中的值
        dirty = false;
      }
      // 当读取 value 时，手动调用 track 函数进行最终测试
      track(obj, 'value');
      return value;
    },
  };

  return obj;
}

const sumRes = computed(() => obj.foo + obj.bar);
console.log(sumRes);
