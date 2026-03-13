# Mobile-Web Usage Guide

## English

### 1. What It Is

- Mobile-first remote client for GyShell sessions.
- Available in two forms:
  - desktop-built-in mobile-web server (`Settings -> Gateway`) for end users
  - standalone dev/preview build (`npm run dev:mobile-web`, `npm run start:mobile-web`) for contributors
- Supports session browse/search, prompt sending, permission replies, rollback, tool toggles, skill toggles, and terminal tab management.
- Does not render the live terminal screen directly.

### 2. Recommended User Path: Desktop-Built-In Mobile Web

1. Open the desktop app.
2. Go to `Settings -> Gateway`.
3. Set `WebSocket Gateway Exposure` to one of:
   - `LAN only`
   - `Custom IP ranges`
   - `Internet`
4. Optional: adjust `WebSocket Gateway Port`.
5. Turn on `Mobile Web Server`.
6. Choose `Auto` or `Manual` mobile-web port.
7. Copy one of the generated `Access Links` and open it on your phone/browser.

Notes:

- The built-in mobile-web server only works when the websocket gateway is reachable from the network. `Localhost only` and `Disabled` are not enough for phones or other devices.
- Generated access links already include `?gateway=ws://...`, so the mobile page usually arrives with the gateway URL prefilled.
- For non-localhost access, create an access token in the same `Gateway` settings page and paste it into the mobile-web `Settings` panel once.

### 3. Standalone / Development Mobile-Web

From repo root:

```bash
npm run dev:mobile-web
```

- Dev server: `http://<host-ip>:5174`

Production-like preview:

```bash
npm run build:mobile-web
npm run start:mobile-web
```

- Preview server: `http://<host-ip>:4174`

### 4. Connect to Backend

Built-in desktop flow:

1. Open a copied desktop `Access Link`.
2. Open the mobile `Settings` panel.
3. Confirm the prefilled gateway URL.
4. Paste an access token if the gateway is not localhost-only.
5. Tap `Connect`.

Manual flow (standalone page or custom deployment):

1. Open mobile-web in browser.
2. Go to `Settings`.
3. Set Gateway URL, for example:

```text
ws://192.168.1.8:17888
```

4. Paste an access token when connecting over LAN/VPN/public interfaces.
5. Tap `Connect`.

Notes:

- `Connect` enables auto-reconnect; `Disconnect` disables it.
- Localhost-only development can usually skip the token.

### 5. Core Workflows

- `Chat`
  - Session browser (search + running indicator)
  - Open/create session
  - Send prompt, stop run
  - Reply permission asks
  - Roll back to a previous message
- `Terminal`
  - Create local terminal tab
  - Create SSH terminal tab from saved desktop SSH connections
  - Close terminal tab (cannot close the last tab)
- `Skills`
  - Toggle skill enablement and reload list
- `Tools`
  - Toggle MCP servers and built-in tools
- `Settings`
  - Update websocket URL
  - Paste/remove access token
  - Connect/disconnect
  - Switch language

### 6. Gateway and Security Notes

- The built-in mobile-web server is only an HTTP host for the frontend. Real task control still goes through the websocket gateway.
- `LAN only` binds all interfaces but only accepts private-network IPv4 clients.
- `Custom IP ranges` binds all interfaces but only accepts clients inside the configured CIDR allowlist.
- Even with access tokens, prefer `localhost`, private LAN, or VPN over direct public-internet exposure.

### 7. Troubleshooting

- `Gateway Not Accessible`
  - Desktop gateway exposure is still `Localhost only` or `Disabled`.
- `missing access token` / `invalid access token`
  - Create a new token in desktop `Settings -> Gateway` and paste it into mobile-web `Settings`.
- `No terminal is available on backend.`
  - Backend has no terminal tab. Start backend with terminal bootstrap enabled, or create one in desktop first.
- `Gateway is disconnected` / timeout
  - Check desktop websocket exposure mode and port.
  - Verify firewall and network route.
- `SSH connection not found. Please configure it in desktop settings first.`
  - Mobile-web reads SSH definitions from backend settings; create the SSH connection in desktop settings first.

---

## 中文

### 1. 它是什么

- 面向手机浏览器的 GyShell 远程会话控制端。
- 现在有两种使用方式：
  - 终端用户推荐直接使用桌面端内置的 Mobile Web 服务（`Settings -> Gateway`）
  - 贡献者可继续使用独立开发/预览构建（`npm run dev:mobile-web`、`npm run start:mobile-web`）
- 支持会话浏览/搜索、发送消息、权限回复、回滚、工具开关、技能开关、终端标签管理。
- 不直接渲染终端实时屏幕内容。

### 2. 推荐用户路径：桌面端内置 Mobile Web

1. 打开桌面 App。
2. 进入 `Settings -> Gateway`。
3. 将 `WebSocket Gateway Exposure` 设为以下之一：
   - `LAN only`
   - `Custom IP ranges`
   - `Internet`
4. 可选：调整 `WebSocket Gateway Port`。
5. 打开 `Mobile Web Server`。
6. 选择 `Auto` 或 `Manual` 的 Mobile Web 端口策略。
7. 复制生成的 `Access Links`，在手机或浏览器中打开。

说明：

- 只有当 websocket 网关对网络可访问时，桌面内置 Mobile Web 才能工作。`Localhost only` 和 `Disabled` 不足以让手机或其他设备连接。
- 生成的访问链接会自动带上 `?gateway=ws://...` 参数，所以移动端页面通常会预填网关地址。
- 如果不是本机 `localhost` 访问，请在同一页 `Gateway` 设置里创建访问令牌，并在移动端 `Settings` 里粘贴一次。

### 3. 独立 / 开发模式 Mobile Web

在仓库根目录执行：

```bash
npm run dev:mobile-web
```

- 开发地址：`http://<host-ip>:5174`

接近生产的预览模式：

```bash
npm run build:mobile-web
npm run start:mobile-web
```

- 预览地址：`http://<host-ip>:4174`

### 4. 连接 Backend

桌面内置方式：

1. 打开从桌面端复制的 `Access Link`。
2. 进入移动端 `Settings` 面板。
3. 确认预填好的 gateway URL。
4. 如果不是 localhost 访问，粘贴访问令牌。
5. 点击 `Connect`。

手动方式（独立页面或自定义部署）：

1. 浏览器打开 mobile-web。
2. 进入 `Settings`。
3. 填写 Gateway URL，例如：

```text
ws://192.168.1.8:17888
```

4. 如果通过局域网/VPN/公网网卡接入，请同时填写访问令牌。
5. 点击 `Connect`。

说明：

- `Connect` 会启用自动重连；`Disconnect` 会关闭自动重连。
- 本机 localhost 开发场景通常可以不填 token。

### 5. 核心使用流程

- `Chat`
  - 会话浏览器（搜索 + 运行状态）
  - 打开/创建会话
  - 发送消息、停止运行
  - 回复权限询问
  - 回滚到历史消息
- `Terminal`
  - 新建本地 terminal tab
  - 基于桌面端已保存 SSH 连接新建 SSH tab
  - 关闭 tab（最后一个 tab 不能关闭）
- `Skills`
  - 切换技能启用状态并刷新列表
- `Tools`
  - 切换 MCP 服务器与内置工具启用状态
- `Settings`
  - 修改 websocket 地址
  - 粘贴/清除访问令牌
  - 连接/断开
  - 切换语言

### 6. 网关与安全说明

- 桌面端内置 Mobile Web 服务只是前端页面的 HTTP 托管层，真正的任务控制仍然走 websocket 网关。
- `LAN only` 会绑定所有网卡，但只允许私网 IPv4 地址接入。
- `Custom IP ranges` 会绑定所有网卡，但只允许配置好的 CIDR 白名单来源接入。
- 即使有访问令牌，也依然更建议使用 `localhost`、私有局域网或 VPN，而不是直接暴露到公网。

### 7. 常见问题

- `Gateway Not Accessible`
  - 桌面端网关暴露范围仍是 `Localhost only` 或 `Disabled`。
- `missing access token` / `invalid access token`
  - 请在桌面端 `Settings -> Gateway` 中重新创建访问令牌，再粘贴到移动端 `Settings`。
- `No terminal is available on backend.`
  - backend 没有 terminal tab。请先启用 bootstrap terminal，或先在桌面端创建 tab。
- `Gateway is disconnected` / timeout
  - 检查桌面端 websocket 暴露模式与端口。
  - 检查防火墙和网络路径。
- `SSH connection not found. Please configure it in desktop settings first.`
  - mobile-web 的 SSH 配置来自 backend settings，需先在桌面端 Settings 中创建 SSH 连接。
