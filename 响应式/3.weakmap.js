// 存储副作用函数的桶

const bucket = new WeakMap();

// 原始数据
const data = { text: 'Hello World', ok: true };
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
  }
})

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
}

function trigger(target, key) {
  // 获得对应key的effect set
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  // 将副作用函数 effect 取出并执行
  effects && effects.forEach(effect => effect());
}

// 定义一个全局变量存储被注册的副作用函数
let activeEffect;

function effect(fn) {
  activeEffect = fn;
  fn();
}

// 执行副作用函数，触发读取
effect(() => {
  console.log('effect run'); // 运行两次
  document.body.innerText = obj.ok ? obj.text : 'not';
})

setTimeout(() => {
  obj.ok = false;
}, 1000)

setTimeout(() => {
  obj.text = 'Hello World2';
}, 2000)