function createRenderer(options) {
  const { createElement, insert, setElementText } = options;

  function patch(n1, n2, container) {
    if (!n1) {
      // n1 不存在意味着挂载
      mountElement(n2, container);
    } else {
    }
  }

  function mountElement(vnode, container) {
    // 创建 dom 节点
    const el = createElement(vnode.type);
    // 处理子节点，如果是字符串，则代表元素具有文本节点
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    }
    // 将元素添加到容器中
    insert(el, container);
  }

  function render(vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将其与旧 vnode 一起传给 patch 函数，进行补丁
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // 新的 vnode 不存在，说明 unmount 操作，
        container.innerHTML = "";
      }
    }

    // 把 vnode 存到 container._vnode 下，即后续渲染中的旧的 vnode
    container._vnode = vnode;
  }

  return { render };
}

const vnode = {
  type: "h1",
  children: "hello",
};

// 创建一个渲染器
const renderer = createRenderer({
  createElement(tag) {
    console.log(`创建元素 ${tag}`);
    return { tag };
  },
  setElementText(el, text) {
    console.log(`设置 ${JSON.stringify(el)} 的文本内容：${text}`);
    el.textContent = text;
  },
  insert(el, parent, anchor = null) {
    console.log("insert", JSON.stringify(el));
    parent.children = el;
  },
});
// 调用 render 函数渲染改 vnode
renderer.render(vnode, document.querySelector("#app"));
