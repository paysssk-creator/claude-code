# 操作 playbook：鼠标与键盘

## 鼠标操作

### 未绑定窗口（全屏）
```json
{ "tool": "left_click", "coordinate": [500, 300] }
{ "tool": "double_click", "coordinate": [500, 300] }
{ "tool": "right_click", "coordinate": [500, 300] }
{ "tool": "mouse_move", "coordinate": [500, 300] }
{ "tool": "left_click_drag", "coordinate": [600, 300], "start_coordinate": [500, 300] }
{ "tool": "scroll", "coordinate": [500, 300], "scroll_direction": "down", "scroll_amount": 5 }
```

### 绑定窗口后
```json
{ "tool": "virtual_mouse", "action": "click", "coordinate": [500, 300] }
{ "tool": "virtual_mouse", "action": "double_click", "coordinate": [500, 300] }
{ "tool": "virtual_mouse", "action": "drag", "coordinate": [600, 300], "start_coordinate": [500, 300] }
{ "tool": "mouse_wheel", "coordinate": [500, 400], "delta": -10 }
```

## 键盘操作

### 未绑定窗口
```json
{ "tool": "type", "text": "hello world" }
{ "tool": "key", "text": "ctrl+s" }
{ "tool": "hold_key", "text": "shift", "duration": 2 }
```

### 绑定窗口后
```json
{ "tool": "virtual_keyboard", "action": "type", "text": "hello world" }
{ "tool": "virtual_keyboard", "action": "combo", "text": "ctrl+s" }
{ "tool": "virtual_keyboard", "action": "hold", "text": "ctrl+a", "duration": 1 }
```

## 中文输入

绑定窗口：
```json
{ "tool": "virtual_keyboard", "action": "type", "text": "你好世界" }
```

未绑定窗口：
```json
{ "tool": "type", "text": "你好世界" }
```

## 批量操作

```json
{
  "tool": "computer_batch",
  "actions": [
    { "tool": "virtual_mouse", "action": "click", "coordinate": [500, 300] },
    { "tool": "virtual_keyboard", "action": "type", "text": "automated input" },
    { "tool": "virtual_keyboard", "action": "combo", "text": "return" }
  ]
}
```

## 注意事项

- 坐标基于窗口或屏幕的左上角原点
- 绑定窗口模式不会移动真实鼠标，但仅适用于传统 Win32/WPF/Office
- 对浏览器、终端等现代应用，需使用通用工具并先激活窗口
