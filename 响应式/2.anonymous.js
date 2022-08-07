


// 存储副作用函数的桶

const bucket = new Set();

// 原始数据
const data = { text: 'Hello World' };
// 对原始的数据进行代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target,key) {
    // 将 activeEffect 中存储的副作用函数收集到桶中
    if (activeEffect) {
      bucket.add(activeEffect);
    }
    return target[key];
  },
  // 拦截写入操作
  set(target, key, newVal) {
    // 设置属性值
    target[key] = newVal;
    // 将副作用函数 effect 取出并执行
    bucket.forEach(effect => effect());
    return true;
  }
})

// 定义一个全局变量存储被注册的副作用函数
let activeEffect;

function effect(fn) {
  activeEffect = fn;
  fn();
}

// 执行副作用函数，触发读取
effect(() => {
  console.log('effect run'); // 运行两次
  document.body.innerText = obj.text;
})

setTimeout(() => {
  obj.notExist = 'Hello World2';
}, 1000)