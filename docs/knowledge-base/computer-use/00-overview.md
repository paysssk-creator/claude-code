# 电脑操控知识库总览

本知识库用于指导 AI 自主操控本地电脑。对应项目能力：`@ant/computer-use-mcp` + `src/utils/computerUse/`。

## 能力范围

- 截图、缩放、切换显示器
- 鼠标：点击、双击、拖拽、滚轮
- 键盘：输入文字、组合键、按住
- 应用：打开应用、绑定窗口、窗口管理
- 剪贴板：读写
- 终端：打开终端并自动绑定
- 批量操作：`computer_batch`

## 两种工作模式

### 模式 A：全屏操作（未绑定窗口）
- 使用通用工具：`left_click`、`type`、`key`、`scroll`
- 操作对象：整个屏幕
- 会移动真实鼠标/键盘，可能干扰用户

### 模式 B：绑定窗口操作（推荐）
- 先 `bind_window(action="bind", title="窗口标题")`
- 使用 `virtual_mouse`、`virtual_keyboard`、`mouse_wheel`
- 不动真实鼠标/键盘，可后台操作
- 绑定后截图会附带 GUI 元素列表

## 标准操作流程

1. `request_access` 请求权限
2. `screenshot` 观察当前状态
3. 根据截图决定下一步操作
4. 操作后再次 `screenshot` 验证
5. 完成时 `bind_window(action="unbind")` 解除绑定

## 平台差异

| 平台 | 键鼠后端 | 截图后端 | 特殊说明 |
|------|---------|---------|---------|
| macOS | CGEvent / JXA | screencapture | 需 accessibility + screenRecording 权限 |
| Windows | SendInput P/Invoke | CopyFromScreen | 支持绑定窗口模式，不干扰用户 |
| Linux | xdotool | scrot/grim | 需安装 xdotool、scrot、xclip |

## 兼容性速查

| 应用类型 | 推荐工具 | 备注 |
|---------|---------|------|
| 传统 Win32（记事本/写字板） | `virtual_*` | 完美支持 |
| Office（Excel/Word） | `virtual_*` / COM | 支持 |
| WPF | `virtual_*` | 支持 |
| Electron/Chrome | 通用工具 + 前台激活 | 内部渲染不走 Win32 |
| Windows Terminal | 通用工具 + 前台激活 | ConPTY 不接受 SendMessageW |
| UWP/WinUI | 通用工具 + 前台激活 | 需前台焦点 |

## 记忆点

- 优先使用绑定窗口模式，避免干扰用户
- 操作后必须截图验证
- 对现代应用（浏览器、终端）回退到通用工具 + 窗口聚焦
- 中文输入用 `virtual_keyboard(action="type", text="...")` 或 `type(text="...")`
