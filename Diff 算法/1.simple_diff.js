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
      // 说明新子节点是一组子节点
      if (Array.isArray(n1.children)) {
        // means old vnode is a group, need diff
        // fallback for now
        const oldChildren = n1.children;
        const newChildren = n2.children;

        // 用来存储寻找过程中遇到的最大索引值
        let lastIndex = 0;
        for (let i = 0; i < newChildren.length; i++) {
          const newVnode = newChildren[i];
          let j = 0;
          // 表示在旧的节点中是否找到可服用的节点
          let find = true;
          for (j; j < oldChildren.length; j++) {
            const oldVnode = oldChildren[j];
            if (newVnode.key === oldVnode.key) {
              // 找到，设置为 true
              find = true;
              patch(oldVnode, newVnode, container);
              if (j < lastIndex) {
                // 先获取到前一个 vnode
                const prevVNode = newChildren[i - 1];
                if (prevVNode) {
                  const anchor = prevVNode.el.nextSibling;
                  insert(newVnode.el, container, anchor);
                }
              } else {
                lastIndex = j;
              }
              break;
            }
          }

          // 说明当前 newVNode 没有在旧的节点中找到可复用的节点
          if (!find) {
            const prevVNode = newChildren[i - 1];
            let anchor = null;
            if (prevVNode) {
              anchor = prevVNode.el.nextSibling;
            } else {
              // 如果没有 prevNode，说明是挂载的第一个节点
              anchor = container.firstChild;
            }
            // 挂在 newVnode
            patch(null, newVnode, container, anchor);
          }
        }

        for (let i = 0; i < oldChildren.length; i++) {
          const oldVNode = oldChildren[i];
          // 找到需要删除的旧节点
          const has = newChildren.find((vnode) => vnode.key === oldVNode.key);

          if (!has) {
            unmount(oldVNode);
          }
        }

        // const oldLen = oldChildren.length;
        // const newLen = newChildren.length;
        // const commonLength = Math.max(oldLen, newLen);

        // // 遍历较短的 children
        // for (let i = 0; i < commonLength; i++) {
        //   patch(oldChildren[i], newChildren[i], container);
        // }

        // // 说明有新的节点需要挂载
        // if (newLen > oldLen) {
        //   for (let i = commonLength; i < newLen; i++) {
        //     patch(null, newChildren[i]);
        //   }
        // } else if (oldLen > newLen) {
        //   // 旧节点卸载
        //   for (let i = commonLength; i < oldLen; i++) {
        //     unmount(oldChildren[i]);
        //   }
        // }
      } else {
        // old vnode is string or null
        setElementText(container, "");
        n2.children.forEach((c) => patch(null, c, container));
      }
    } else {
      // new vnode if null, unmount all old vnode
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      } else if (typeof n1.children === "string") {
        setElementText(container, "");
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
    //  如果节点已经存在于 dom 中，则 insertBefore 会从原有的 parent 中删除节点，并移动值新的 parent 中
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
