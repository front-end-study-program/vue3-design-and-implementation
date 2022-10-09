// 将模板 -> 模板AST

// 定义状态机的状态
const State = {
  initial: 1, // 初始状态
  tagOpen: 2, // 标签开始状态
  tagName: 3, // 标签名称状态
  text: 4, // 文本状态
  tagEnd: 5, // 结束标签状态
  tagEndName: 6 // 结束标签名称状态
}

// 判断是否是字母
function isAlpha(char) {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

// 接收模板字符串作为参数，并将模板切割为 Token 返回
function tokenzie(str) {
  // 状态机当前状态：初始状态
  let currentState = State.initial
  // 缓存字符
  const chars = []
  // 生成的 Token 会存储到 tokens 的数组中，并作为函数的返回值返回
  const tokens = []

  while (str) {
    // 查看第一个字符
    const [char] = str

    switch (currentState) {
      // 状态机当前处于初始状态
      case State.initial:
        // 遇到字符 <
        if (char === '<') {
          // 1. 状态机切换到标签开始状态
          currentState = State.tagOpen
          // 2. 消费字符 <
          str = str.slice(1)
        } else if (isAlpha) {
          // 1. 遇到字母，切换文本状态
          currentState = State.text
          // 2. 将当前字母缓存到 chars 数组
          chars.push(char)
          // 3. 消费当前字母
          str = str.slice(1)
        }
        break
      // 状态机当前处于标签开始状态
      case State.tagOpen:
        if (isAlpha(char)) {
          // 1. 遇到字母，切换到标签名称状态
          currentState = State.tagName
          // 2. 将当前字符缓存到 chars 数组
          chars.push(char)
          // 3. 消费当前字符
          str = str.slice(1)
        } else if (char === '/') {
          // 1. 遇到字符 /，切换到结束标签状态
          currentState = State.tagEnd
          // 2. 消费字符 /
          str = str.slice(1)
        }
        break
      // 状态机当前处于标签名称状态
      case State.tagName:
        if (isAlpha(char)) {
          // 1. 遇到字母，由于当前处于标签名称状态，所以不需要切换状态，缓存到 chars 数组
          chars.push(char)
          // 2. 消费当前字符
          str = str.slice(1)
        } else if (char === '>') {
          // 1. 遇到字符 >，切换到初始状态
          currentState = State.initial
          // 2. 同时创建一个标签 Token，并添加到 tokens 数组中
          // 此时 chars 数组中缓存的字符就是标签名称
          tokens.push({
            type: 'tag',
            name: chars.join('')
          })
          // 3. chars 数组的内容已经被消费，清空
          chars.length = 0
          // 4. 消费当前字符
          str = str.slice(1)
        }
        break
      // 状态机当前处于文本状态
      case State.text:
        if (isAlpha(char)) {
          // 1. 遇到字母，保持不变，字符缓存到 chars 数组
          chars.push(char)
          // 2. 消费当前字符
          str = str.slice(1)
        } else if (char === '<') {
          // 1. 遇到字符 <，切换到标签开始状态
          currentState = State.tagOpen
          // 2. 从文本状态 --> 标签开始状态，此时应该创建文本 Token，并添加到 tokens 数组
          // 此时 chars 数组中的字符就是文本内容
          tokens.push({
            type: 'text',
            content: chars.join('')
          })
          // 3. chars 数组的内容已经被消费，清空
          chars.length = 0
          // 4. 消费当前字符
          str = str.slice(1)
        }
        break
      // 状态机当前处于标签结束状态
      case State.tagEnd:
        if (isAlpha(char)) {
          // 1. 遇到字母，切换到结束标签名称状态
          currentState = State.tagEndName
          // 2. 将当前字符缓存到 chars 数组
          chars.push(char)
          // 3. 消费当前字符
          str = str.slice(1)
        }
        break
      //状态机当前处于结束标签名称状态
      case State.tagEndName:
        if (isAlpha(char)) {
          // 1. 遇到字母，不需要切换状态，需要将当前字符缓存到 chars 数组
          chars.push(char)
          // 2. 消费当前字符
          str = str.slice(1)
        } else if (char === '>') {
          // 1. 遇到字符 >，切换到标签初始状态
          currentState = State.initial
          // 2. 从结束标签名称状态 --> 初始状态，应该保存结束标签名称 Token
          // 此时 chars 数组中缓存的内容就是标签名称
          tokens.push({
            type: 'tagEnd',
            name: chars.join('')
          })
          // 3. chars 数组的内容已经被消费，清空
          chars.length = 0
          // 4. 消费当前字符
          str = str.slice(1)
        }
        break
      default:
        break
    }
  }

  return tokens
}

// console.log(tokenzie('<div><p>Vue</p><p>Template</p></div>'), 'tokens')

// 将模板 --> 模板 AST
function parse(str) {
  // 对模板进行标记化，得到 tokens
  const tokens = tokenzie(str)
  // 创建 Root 根节点
  const root = {
    type: 'Root',
    children: []
  }
  // 创建 elementStack 栈，起初只有 Root 根节点
  const elementStack = [root]

  while (tokens.length) {
    // 获取栈顶节点作为父节点 parent
    const parent = elementStack[elementStack.length - 1]

    // 当前扫面的 token
    const [t] = tokens

    switch (t.type) {
      case 'tag':
        // 如果当前 Token 是开始标签，则创建 Element 类型的 AST 节点
        // eslint-disable-next-line no-case-declarations
        const elementNode = {
          type: 'Element',
          tag: t.name,
          children: []
        }
        // 将其添加到父级节点的 children 中
        parent.children.push(elementNode)
        // 将当前节点压入栈
        elementStack.push(elementNode)
        break
      case 'text':
        // 如果当前 Token 是文本，则创建 Text 类型的 AST 节点
        // eslint-disable-next-line no-case-declarations
        const textNode = {
          type: 'Text',
          content: t.content
        }
        // 将其添加到父节点的 children 中
        parent.children.push(textNode)
        break
      case 'tagEnd':
        // 遇到结束标签，将栈顶节点弹出
        elementStack.pop()
        break
      default:
        break
    }
    tokens.shift()
  }

  return root
}

const ast = parse('<div><p>Vue</p><p>Template</p></div>')

console.log(ast, 'templateAst')