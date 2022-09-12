const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();

// from: https://juejin.cn/post/6988489193215229982
// arr: 位置数组；
// 返回位置数组的递增子系列
function getSequence(arr) {
  const p = arr.slice(); // 拷贝一个数组 p，p[i]记录的是result在arr[i]更新前记录的上一个值,保存当前项对应的前一项的索引
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    // 遍历位置数组
    // 排除等于 0 的情况
    if (arrI !== 0) {
      j = result[result.length - 1];
      // (1) arrI 比 arr[j]大（当前值大于上次最长子系列的末尾值），直接添加
      if (arr[j] < arrI) {
        p[i] = j; // 最后一项与 p 对应的索引进行对应, 保存上一次最长递增子系列的最后一个值的索引
        result.push(i); // result 存储的是长度为 i 的递增子序列最小末尾值的索引集合
        //（最小末尾值：要想得到最长递增子系列，需要子系列增长越慢越好，所以子系列末尾值需要最小）
        continue;
      }

      // (2) arrI <= arr[j] 通过二分查找，找到后替换它；u和v相等时循环停止
      // 定义二分查找区间[u, v]
      u = 0;
      v = result.length - 1;
      // 开启二分查找
      while (u < v) {
        // 取整得到当前位置
        c = ((u + v) / 2) | 0;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }

      // 比较 => 替换, 当前子系列从头找到第一个大于当前值arrI，并替换
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]; // 与p[i] = j作用一致
        }
        result[u] = i; // 有可能替换会导致结果不正确，需要一个新数组 p 记录正确的结果
      }
    }
  }

  // 前面的逻辑与 leetcode 300 求最长子系列长度相似
  // 下面主要的修正由于贪心算法可能造成的最长递增子系列在原系列中不是正确的顺序
  u = result.length;
  v = result[u - 1];
  // 倒叙回溯 用 p 覆盖 result 进而找到最终正确的索引
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}

function shouldSetAsProps(el, key, value) {
  // 特殊处理
  if (key === "form" && el.tagName === "INPUT") return false;
  // 默认逻辑
  return key in el;
}

function createRenderer(options) {
  const {
    createElement,
    insert,
    setElementText,
    patchProps,
    setText,
    createText,
  } = options;

  function patch(n1, n2, container, anchor) {
    // 如果 n1 存在，说明需要更新，对比 n1 和 n2 的类型
    if (n1 && n1.type !== n2.type) {
      // 类型不同直接卸载
      unmount(n1);
      n1 = null;
    }

    const { type } = n2;
    if (typeof type === "string") {
      if (!n1) {
        mountElement(n2, container, anchor);
      } else {
        patchElement(n1, n2);
      }
    } else if (typeof type === "object") {
      // 描述组件
    } else if (typeof type === "xxx") {
      // xxxx
    } else if (type === Text) {
      if (!n1) {
        const el = (n2.el = createText(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n2.children !== n1.children) {
          // 更新文本内容
          setText(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      if (!n1) {
        n2.children.forEach((c) => patch(null, c, container));
      } else {
        patchChildren(n1, n2, container);
      }
    }
  }

  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    const oldProps = n1.props || {};
    const newProps = n2.props || {};
    // 第一步：更新 props
    for (const key of Object.keys(newProps)) {
      if (newProps[key] !== oldProps[key]) {
        patch(el, key, oldProps[key], newProps[key]);
      }
    }
    for (const key in Object.keys(oldProps)) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null); // 删除一些属性
      }
    }

    // 更新 children
    patchChildren(n1, n2, el);
  }

  function patchChildren(n1, n2, container) {
    // 判断新子节点的类型是否是文本节点
    if (typeof n2.children === "string") {
      // 当旧子节点为一组时，需要阻隔卸载
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      }
      setElementText(container, n2.children);
    } else if (Array.isArray(n2.children)) {
      patchKeyedChildren(n1, n2, container);
    } else {
      // new vnode if null, unmount all old vnode
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      } else if (typeof n1.children === "string") {
        setElementText(container, "");
      }
    }
  }

  function patchKeyedChildren(n1, n2, container) {
    const newChildren = n2.children;
    const oldChildren = n1.children;

    let j = 0;
    let oldVNode = oldChildren[j];
    let newVNode = newChildren[j];

    // 同时遍历，直到找到第一个不相同的 key
    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container);
      j++;
      oldVNode = oldChildren[j];
      newVNode = newChildren[j];
    }

    let oldEnd = oldChildren.length - 1;
    let newEnd = newChildren.length - 1;

    oldVNode = oldChildren[oldEnd];
    newVNode = newChildren[newEnd];

    // 向前循环，直到找到不同的 key
    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container);
      oldEnd--;
      newEnd--;
      oldVNode = oldChildren[oldEnd];
      newVNode = newChildren[newEnd];
    }

    // 预处理完成，处理需要新挂载的节点
    if (j > oldEnd && j <= newEnd) {
      // 锚点索引
      const anchorIndex = newEnd + 1;
      const anchor =
        anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;

      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor);
      }
    } else if (j > newEnd && j <= oldEnd) {
      while (j <= oldEnd) {
        unmount(oldChildren[j++]);
      }
    } else {
      // 新的一组子节点中剩余未处理节点的数量
      const count = newEnd - j + 1;
      const source = new Array(count);
      source.fill(-1);

      // 填充 source，对应旧节点里的索引
      const oldStart = j;
      const newStart = j;

      // 新增变量
      let moved = false;
      let pos = 0;
      // 构建索引表
      const keyIndex = {};
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i;
      }

      // 表示更新过的节点
      let patched = 0;
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldChildren[i];
        // 如果 patched<=count ，说明需要
        if (patch <= count) {
          // k 表示 newNode 的 key
          const k = keyIndex[oldVNode.key];
          if (typeof k !== "undefined") {
            newVNode = newChildren[k];
            patch(oldVNode, newVNode, container);
            patched++;
            source[k - newStart] = i;
            // 判断递增序列
            if (k < pos) {
              moved = true;
            } else {
              pos = k;
            }
          } else {
            unmount(oldVNode);
          }
        } else {
          // 卸载多余的节点
          unmount(oldVNode);
        }
      }

      if (moved) {
        // 计算最长递增子序列
        const seq = lis(source);
        let s = seq.length - 1;
        let i = count - 1;
        for (i; i >= 0; i--) {
          // 说明索引为新节点，需要挂载
          if (source[i] === -1) {
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            // 锚点
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            patch(null, newVNode, container, anchor);
          }
          if (i !== seq[s]) {
            // 需要移动
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            insert(newVNode.el, container, anchor);
          } else {
            s--;
          }
        }
      }
    }
  }

  function mountElement(vnode, container, anchor) {
    // 创建 dom 节点
    const el = (vnode.el = createElement(vnode.type));
    // 处理子节点，如果是字符串，则代表元素具有文本节点
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载
      vnode.children.forEach((child) => {
        patch(null, child, el);
      });
    }

    if (vnode.props) {
      // 遍历 vnode.props
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key]);
      }
    }

    // 将元素添加到容器中
    insert(el, container, anchor);
  }

  function unmount(vnode) {
    // 卸载 Fragment，需要卸载其 children
    if (vnode.type === Fragment) {
      vnode.children.forEach((c) => unmount(c));
      return;
    }
    const parent = vnode.el.parentNode;
    if (parent) {
      parent.removeChild(el);
    }
  }

  function render(vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将其与旧 vnode 一起传给 patch 函数，进行补丁
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // unmount 操作
        unmount(container._vnode);
      }
    }

    // 把 vnode 存到 container._vnode 下，即后续渲染中的旧的 vnode
    container._vnode = vnode;
  }

  return { render };
}

const vnode = {
  type: "div",
  props: {
    id: "foo",
  },
  children: [
    {
      type: "p",
      children: "hello",
    },
  ],
};

// 创建一个渲染器
const renderer = createRenderer({
  createElement(tag) {
    return document.createElement(tag);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor);
  },
  createText(text) {
    return document.createTextNode(text);
  },
  setText(el, text) {
    el.nodeValue = text;
  },
  // 将属性设置相关操作分装到 patchProps 函数中，并作为渲染器选项传递
  patchProps(el, key, prevValue, nextValue) {
    // event handle
    if (/^on/.test(key)) {
      // 事件名映射
      let invokers = el._vei || (el._vei = {});
      let invoker = invokers[key];
      const name = key.slice(2).toLowerCase();
      if (nextValue) {
        if (!invoker) {
          // 伪造一个 invoker 缓存到 el._vei(vue event invoker) 中
          // invoker 设计成对象，避免覆盖
          invoker = el._vei[key] = (e) => {
            // 如果事件发生的时间早于绑定的事件，不执行处理函数
            if (e.timeStamp < invoker.attached) return;
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e));
            } else {
              invoker.value(e);
            }
          };
          invoker.value = nextValue;
          invoker.attached = performance.now();
          el.addEventListener(name, invoker);
        } else {
          // 如果 invoker 存在，意味着更新
          invoker.value = nextValue;
        }
      } else if (invoker) {
        // 新的事件绑定函数不存在，且之前绑定的 invoker 存在，则移除绑定
        el.removeEventListener(name, invoker);
      }
    }
    // 对 class 做特殊处理
    if (key === "class") {
      el.className = nextValue || "";
    } else if (shouldSetAsProps(el, key, value)) {
      // 判断 key 是否存在对应的 DOM Properties，优先级 DOM Properties > setAttribute
      const type = typeof el[key];
      const value = vnode.props[key];
      if (value === "" && type === "boolean") {
        el[key] = true;
      } else {
        el[key] = value;
      }
    } else {
      el.setAttribute(key, vnode.props[key]);
    }
  },
});

// const oldVNode = {
//   type: "div",
//   children: [
//     { type: "p", children: "1", key: 1 },
//     { type: "p", children: "2", key: 2 },
//     { type: "p", children: "hello", key: 3 },
//   ],
// };

// const newVNode = {
//   type: "div",
//   children: [
//     { type: "p", children: "World", key: 3 },
//     { type: "p", children: "1", key: 1 },
//     { type: "p", children: "2", key: 2 },
//   ],
// };
// 调用 render 函数渲染改 vnode
renderer.render(oldVNode, document.querySelector("#app"));
setTimeout(() => {
  renderer.render(newVNode, document.querySelector("#app"));
}, 1000);
