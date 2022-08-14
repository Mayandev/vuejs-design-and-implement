const p = Promise.resolve();

// 一个标志代表是否正在刷新队列
let isFlushing = false;
function flushJob(index) {
  // 如果队列正在刷新，则什么也不做
  if (isFlushing) return;
  // 将 isFlushing 设置为 true，代表正在刷新
  isFlushing = true;
  // 将 jobQueue 中的任务取出，并执行
  p.then(() => {
    console.log('Microtask queue', index);
  }).finally(() => {
    // 结束后重置 isFlushing
    isFlushing = false;
  })
}

for (let i = 0; i < 10; i++) {
  console.log('Main thread', i);
  flushJob(i);
}