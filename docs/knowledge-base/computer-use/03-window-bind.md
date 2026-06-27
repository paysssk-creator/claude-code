# 操作 playbook：窗口绑定与管理

## 绑定窗口流程

### 1. 列出窗口
```json
{ "tool": "bind_window", "action": "list" }
```

### 2. 绑定指定窗口
按标题：
```json
{ "tool": "bind_window", "action": "bind", "title": "记事本" }
```

按 hwnd：
```json
{ "tool": "bind_window", "action": "bind", "hwnd": 123456 }
```

按 pid：
```json
{ "tool": "bind_window", "action": "bind", "pid": 1234 }
```

### 3. 查看绑定状态
```json
{ "tool": "bind_window", "action": "status" }
```

### 4. 解除绑定
```json
{ "tool": "bind_window", "action": "unbind" }
```

## 窗口管理（Windows 专属）

```json
{ "tool": "window_management", "action": "minimize" }
{ "tool": "window_management", "action": "maximize" }
{ "tool": "window_management", "action": "restore" }
{ "tool": "window_management", "action": "focus" }
{ "tool": "window_management", "action": "close" }
{ "tool": "window_management", "action": "move_resize", "x": 100, "y": 100, "width": 1280, "height": 720 }
{ "tool": "window_management", "action": "get_rect" }
```

## 打开应用

```json
{ "tool": "open_application", "app": "Notepad" }
```

Windows 上会自动绑定窗口。

## 最佳实践

- 绑定后窗口会出现绿色边框和虚拟光标
- 绑定窗口操作不干扰用户，适合长时间自动化
- 操作完成后建议 `unbind` 释放资源
- 若目标应用是浏览器/终端，绑定后仍可能需用通用工具
