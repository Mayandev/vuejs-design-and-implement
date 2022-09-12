const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();

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
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;
    // 四个索引指向的 vnode 节点
    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndVNode = oldChildren[oldEndIdx];
    let newStartVNode = newChildren[newStartIdx];
    let newEndVNode = newChildren[newEndIdx];

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      // 增加两个判断分支，如果头尾部节点为 undefined， 直接跳过
      if (!oldStartVNode) {
        oldStartVNode = oldChildren[++oldStartIdx];
      } else if (!oldEndVNode) {
        oldEndVNode = oldChildren[--oldEndIdx];
      } else if (oldStartVNode.key === newStartVNode.key) {
        patch(oldStartVNode, newStartVNode, container);
        oldStartVNode = oldChildren[++oldStartIdx];
        newStartVNode = newStartVNode[++newStartIdx];
      } else if (oldEndVNode.key === newEndVNode.key) {
        // step 2
        patch(oldEndVNode, newEndVNode, container);
        oldEndVNode = oldChildren[--oldEndIdx];
        newEndIdx = newChildren[--newEndIdx];
      } else if (oldStartVNode.key === newEndVNode.key) {
        // step 3
        patch(oldStartVNode, newEndVNode, container);
        // 移动到当前旧子节点的尾部
        insert(oldStartVNode, container, oldEndVNode.el.nextSibling);
      } else if (oldEndVNode.key === newStartVNode) {
        // step 4
        patch(oldEndVNode, newStartVNode, container);
        // 移动 dom
        // oldEndVNode 移动到 oldStartVNode 前面
        insert(oldEndVNode.el, container, oldStartVNode.el);
        // 移动完，更新索引值，并指向下一个位置
        oldEndVNode = oldChildren[--oldEndIdx];
        newStartVNode = newChildren[++newStartIdx];
      } else {
        // 极端情况，先找到第一个复用的 oldStartVNode index
        const idxInOld = oldChildren.findIndex(
          (node) => node.key === newStartVNode.key
        );

        if (idxInOld > 0) {
          // 需要移动的节点
          const vnodeToMove = oldChildren[idxInOld];
          patch(vnodeToMove, newStartVNode, container);
          // 移动到头部节点
          insert(vnodeToMove.el, container, newStartVNode.el);
          // 正式节点已经移动，这里将其设置为 undefined
          oldChildren[idxInOld] = undefined;
          newStartVNode = newChildren[++newStartIdx];
        } else {
          // 说明没找到，需要新增
          patch(null, newStartVNode, container, oldStartVNode.el);
        }

        newStartVNode = newChildren[++newStartIdx];
      }
    }

    // fallback 情况
    if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
      // 说明有节点遗留
      for (let i = newStartIdx; i <= newEndIdx; i++) {
        patch(null, newChildren[i], container, oldStartVNode.el);
      }
    } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
      // 执行删除操作
      for (let i = oldStartIdx; i <= oldEndIdx; i++) {
        unmount(oldChildren[i]);
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

const oldVnode = {
  type: "div",
  children: [
    { type: "p", children: "1", key: 1 },
    { type: "p", children: "2", key: 2 },
    { type: "p", children: "hello", key: 3 },
  ],
};

const newVnode = {
  type: "div",
  children: [
    { type: "p", children: "World", key: 3 },
    { type: "p", children: "1", key: 1 },
    { type: "p", children: "2", key: 2 },
  ],
};
// 调用 render 函数渲染改 vnode
renderer.render(oldVnode, document.querySelector("#app"));
setTimeout(() => {
  renderer.render(newVnode, document.querySelector("#app"));
}, 1000);
