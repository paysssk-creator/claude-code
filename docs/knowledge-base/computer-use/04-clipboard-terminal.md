# 操作 playbook：剪贴板与终端

## 剪贴板

### 读取剪贴板
```json
{ "tool": "read_clipboard" }
```

### 写入剪贴板
```json
{ "tool": "write_clipboard", "text": "要放入剪贴板的文本" }
```

### 粘贴到应用
绑定窗口：
```json
{ "tool": "virtual_keyboard", "action": "combo", "text": "ctrl+v" }
```

macOS：
```json
{ "tool": "key", "text": "command+v" }
```

## 终端交互

### 打开新终端并启动 agent
```json
{ "tool": "open_terminal", "agent": "claude" }
```

可选 agent：`claude`、`codex`、`gemini`、`custom`。

### 自定义命令
```json
{ "tool": "open_terminal", "agent": "custom", "command": "npm run dev" }
```

### 响应终端提示
确认 yes：
```json
{ "tool": "prompt_respond", "response_type": "yes" }
```

拒绝 no：
```json
{ "tool": "prompt_respond", "response_type": "no" }
```

选择菜单第 3 项：
```json
{ "tool": "prompt_respond", "response_type": "select", "arrow_direction": "down", "arrow_count": 2 }
```

输入文本：
```json
{ "tool": "prompt_respond", "response_type": "type", "text": "my-input" }
```

## 典型工作流

1. `open_terminal` 打开终端
2. `screenshot` 查看终端内容
3. `prompt_respond` 回答交互提示
4. `write_clipboard` + 粘贴 输入复杂命令
5. `screenshot` 验证执行结果
