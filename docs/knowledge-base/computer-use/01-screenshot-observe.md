# 操作 playbook：截图观察

## 目标
获取当前屏幕或指定窗口的画面，识别 UI 元素和当前状态。

## 步骤

### 1. 请求权限
```json
{
  "tool": "request_access",
  "apps": ["目标应用名称"],
  "reason": "需要截图观察并执行自动化操作"
}
```

### 2. 全屏截图
```json
{
  "tool": "screenshot"
}
```

### 3. 绑定窗口后截图（推荐）
```json
{
  "tool": "bind_window",
  "action": "bind",
  "title": "窗口标题"
}
```
然后：
```json
{
  "tool": "screenshot"
}
```

### 4. 区域放大截图
```json
{
  "tool": "zoom",
  "region": [x1, y1, x2, y2]
}
```
坐标基于最近一次全屏截图。

## 输出解读

- 截图图片
- GUI 元素列表（绑定窗口时）：`[Button] "Save" (120,50 80x30) enabled`
- 元素名称、角色、坐标、大小、是否启用、automationId

## 后续决策

根据截图中的文字、按钮、输入框位置，选择：
- 坐标操作：`virtual_mouse(action="click", coordinate=[x, y])`
- 元素操作：`click_element(name="Save", role="Button")`
