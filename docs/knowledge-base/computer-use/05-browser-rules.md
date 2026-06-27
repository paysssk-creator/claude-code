# 操作 playbook：浏览器操作规则

## 核心规则

**每次操作浏览器前，必须先截图观察当前桌面和浏览器状态。**

原因：
- 避免丢失前面的页面上下文
- 避免重复打开相同网页
- 确认当前焦点标签页和输入框内容

## 标准流程

### 1. 观察当前状态
```json
{ "tool": "screenshot" }
```

查看：
- 桌面上已打开的浏览器窗口
- 浏览器当前标签页标题
- 地址栏 URL
- 页面中的输入框、按钮、链接

### 2. 决定操作方式

情况 A：浏览器未打开
- `open_application(app="Chrome")` 或 `open_application(app="Edge")`
- 等待加载完成后 `screenshot`

情况 B：浏览器已打开，需要访问新网站
- 优先在当前窗口新建标签页：`key(text="ctrl+t")`
- 在地址栏输入 URL：`type(text="https://example.com")` 然后 `key(text="return")`
- 不要直接再启动一个浏览器实例

情况 C：浏览器已打开，需要切换标签页
- `key(text="ctrl+tab")` 或 `key(text="ctrl+1")` / `key(text="ctrl+2")` 等
- 切换后 `screenshot` 确认

### 3. 执行操作并验证

每次点击、输入、跳转后：
```json
{ "tool": "screenshot" }
```

## 典型场景

### 打开指定网页
```json
{ "tool": "screenshot" }
{ "tool": "key", "text": "ctrl+t" }
{ "tool": "type", "text": "https://www.anthropic.com" }
{ "tool": "key", "text": "return" }
{ "tool": "screenshot" }
```

### 在已有网页中输入
```json
{ "tool": "screenshot" }
{ "tool": "left_click", "coordinate": [500, 300] }  // 点击输入框
{ "tool": "type", "text": "搜索内容" }
{ "tool": "key", "text": "return" }
{ "tool": "screenshot" }
```

### 关闭不需要的标签页
```json
{ "tool": "key", "text": "ctrl+w" }
{ "tool": "screenshot" }
```

## 禁止行为

- ❌ 不截图就直接打开新浏览器
- ❌ 不确认当前标签页就输入 URL
- ❌ 连续打开多个相同网页而不检查

## 记忆口诀

> 先看桌面，再动浏览器；操作一步，截图验证。
