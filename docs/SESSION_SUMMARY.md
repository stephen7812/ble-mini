# 会话总结 — 广播控制集成与 UI 美化

**日期**: 2026-07-09  
**项目**: 黑蚂蚁阀门 BLE 控制小程序 (Mpx)  
**路径**: `/Users/yinxuefeng/works/zf/code/zf-mpx/`

---

## 已完成工作

### 1. BLE Beacon 广播发送集成

**背景**：微信小程序支持以 BLE 外设角色发送广播包（`wx.createBLEPeripheralServer` + `server.startAdvertising`），通过 `manufacturerData` 携带编码后的指令数据。PAN1026 芯片实时监听 `Company: 0x00C7` 的广播包并解码执行。

**新增文件** `src/services/beacon/`：

| 文件 | 来源 | 说明 |
|------|------|------|
| `crc16.js` | SDK `crc16.js` | CRC16 校验（poly 0x1021，含 `invert_8`/`invert_16`） |
| `whitening.js` | SDK `whitening.js` | `whitening_init` + `whitenging_encode` 两级白化 |
| `bleUtil.js` | SDK `BLEUtil.js` | 核心编码：`get_1rf_1payload`（前导码 + 地址倒序 + CRC + PAN1026 白化 + BLE 白化） |
| `index.js` | 参考 SDK `advertise297.js` | BLE 外设封装：`initBeacon` → `broadcastOnce(payload, 3s)` → 自动停止 |

**编码流程**（匹配 Android SDK `RF297L.java`）：
1. 组装：`0x71 0x0F 0x55` + address(倒序) + rf_payload
2. `invert_8`：前 3+addr_len 字节逐位反转
3. CRC16：address + rf_payload 计算
4. PAN1026 白化（信道 0x3F）
5. BLE 白化（信道 37/38/39）
6. 输出：3 + addr_len + payload_len + 2 字节

**BLE 广播参数**：
- 厂商 ID：`0x00C7`（Panchip）
- 连接模式：`connectable: false`
- 发射功率：`high`
- 广播时长：3 秒后自动 `stopAdvertising`

### 2. 广播控制页改造

**文件**：`src/pages/broadcast/index.mpx`

- 新增「广播配置」折叠面板：设备地址输入 + 信道选择 + 保存/初始化/关闭按钮
- 指令按钮现在真实发送 BLE 广播（`sendCmd` → `broadcastCmd` → `generateData` → `broadcastOnce`）
- 日志新增发送成功/失败状态标识（✓/✗）
- 配置状态指示器（"蓝牙广播已就绪" 绿色标签）

### 3. 协议层改进

**文件**：`src/services/protocol/old-valve.js`

- `buildFrame` 改为 16 字节定长帧，`new Uint8Array(16)` + `fill(0xFF)` 填充
- 字节 1 低 4 位为递增流水号（`_seq`），初始值 = 2
- 流水号重置时机：广播页 `onLoad` / 清空日志 / 控制页连接/断开
- `export function resetSeq()` 用于外部重置
- `parseResponse` 修复：响应帧无子命令字节，数据从 byte 1 开始

### 4. 首页 UI 美化

**文件**：`src/pages/index/index.mpx`

- Hero 头部：渐变蓝色图标 + 品牌名称 + 副标题
- 设备编号输入：优化输入框样式 + 扫码按钮带图标
- 阀门类型：双卡片式切换（先导/智能），带图标 + 描述
- 控制模式：双卡片切换（广播/蓝牙），带 emoji + 说明
- 操作按钮：渐变胶囊按钮，带箭头 + 阴影
- 连接记录：绿点状态指示器，圆角卡片，品牌色标签

### 5. 文档

**文件**：`docs/broadcast-logic.md`

完整的广播发送逻辑文档，包含流程图、文件职责、协议格式、编码细节、BLE 参数、与 GATT 模式对比。

---

## 待办 / 已知问题

### 1. 验证广播是否生效

- **目标**：确认小程序通过 BLE beacon 广播的指令能被阀门接收执行
- **方法**：另一台手机装 nRF Connect / LightBlue 扫描，过滤 `Company: 0x00C7`，对比 SDK 官方 App 发出的广播数据格式
- **状态**：❌ Mac 上 LightBlue 新版阉割了扫描功能，brew 安装 bluetility/nRF-Connect 超时，需用手机验证

### 2. 设备地址（关键！）

- **说明**：`generateData(hex)` 需要从 `wx.getStorageSync('address')` 读取 PAN1026 芯片地址
- **默认值**：SDK 示例中默认地址为 `CC:CC:CC:CC:CC`（5 字节）
- **问题**：实际阀门地址未知，需从 PDF 文档或设备标签获取
- **状态**：⏳ 等待用户提供

### 3. 广播 payload 长度 vs 阀门固件配置

- **说明**：`src/services/beacon/bleUtil.js` 中发送的 payload 为 16 字节命令帧
- **隐患**：SDK 中 PAN1026 `config_rf.h` 的 `CONFIG_PAYLOAD_WIDTH = 8`，但官方 App 和 WeChat Demo 均支持任意长度 payload（SDK 编码后作为 BLE manufacturerData 发送，不受此限制）
- **状态**：❓ 需要实测验证 16 字节指令是否正常接收

### 4. 先导调节阀（新阀）的广播支持

- **说明**：广播页当前通过 `getProtocol(mode).commands` 获取指令定义
- **新阀**：`NEW_COMMANDS` 已在 `new-valve.js` 中定义，`buildFrame` 也已改为 16 字节定长帧
- **状态**：✅ 代码已适配，未实测

### 5. 其他

- [ ] 重启调试服务后验证空白页问题是否解决（dev server 需重新编译新加的 beacon 模块）
- [ ] 新阀 `new-valve.js` 的指令表是否与 PDF 文档完全一致

---

## 关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 广播角色 | BLE 外设（`wx.createBLEPeripheralServer`） | 微信小程序不支持广播接收，只支持外设广播 |
| 厂商 ID | `0x00C7` | Panchip 官方 Bluetooth SIG 分配 ID |
| 编码算法 | SDK `RF297L.java` / `BLEUtil.js` 同一套 | 保证与官方 App 兼容 |
| 帧格式 | 16 字节定长，0xFF 填充 | 匹配 PDF 协议文档要求 |
| 流水号 | 从 2 递增，低 4 位 | 匹配官方 App 行为 |
| 广播时长 | 3 秒自动停止 | 避免持续广播耗电，单次指令足够了 |

---

## 关键文件索引

```
src/
├── pages/
│   ├── index/index.mpx        # 首页（已美化）
│   ├── broadcast/index.mpx     # 广播控制页（已集成真实发送）
│   ├── control/index.mpx       # BLE 连接控制页
│   ├── scan/index.mpx          # 扫码页
│   └── device-info/index.mpx   # 设备信息页
├── services/
│   ├── beacon/
│   │   ├── index.js            # BLE 外设服务（init → broadcastOnce → stop）
│   │   ├── bleUtil.js          # PAN1026 编码核心
│   │   ├── whitening.js        # 白化算法
│   │   └── crc16.js            # CRC16 算法
│   ├── protocol/
│   │   ├── factory.js          # 协议工厂
│   │   ├── old-valve.js        # 智能调节阀协议（16字节帧 + 流水号）
│   │   └── new-valve.js        # 先导调节阀协议（16字节帧）
│   └── ble/
│       ├── connector.js        # BLE GATT 连接器
│       ├── scanner.js          # BLE 扫描器
│       └── matcher.js          # 设备匹配逻辑
├── stores/
│   └── device.js               # Pinia 状态管理
└── utils/
    └── convert.js              # 工具函数
docs/
├── broadcast-logic.md          # 广播发送逻辑文档
└── SESSION_SUMMARY.md          # 本文件（当前会话总结）
```
