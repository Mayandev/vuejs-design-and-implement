


// 存储副作用函数的桶

const bucket = new Set();

// 原始数据
const data = { text: 'Hello World' };
// 对原始的数据进行代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target,key) {
    // 将副作用函数 effect 添加到副作用函数的桶中
    bucket.add(effect);
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

function effect() {
  document.body.innerText = obj.text;
}

 
setTimeout(() => {
  obj.text = 'Hello World2';
})