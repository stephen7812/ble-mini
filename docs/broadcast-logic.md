# 广播控制发送逻辑

## 整体流程

```
用户点击指令按钮（如"全开"）
  → sendCmd('setOpening', '全开', [100])
     ↓
  1. 协议打包：buildFrame(0x2, 0x1, [100])
     → 16 字节定长帧: 221d64ffffffffffffffffffffffffff
     → 0x1d 低4位 0xd 为递增流水号
     ↓
  2. broadcastCmd(hex, name)
     ↓
  3. PAN1026 编码：generateData(hex) ← bleUtil.js
     ├─ 从 wx.getStorageSync('address') 读取设备地址
     ├─ 从 wx.getStorageSync('channel') 读取信道(默认37)
     └─ get_1rf_1payload(address, addr_len, rf_payload, payload_len)
         ↓
     [编码过程]
     ① 构造 BLE 链路帧:
        [前导码 0x710F55] + [设备地址(倒序)] + [RF载荷] + [CRC16]
     ② 前导码 + 地址 → 逐位反转(invert_8)
     ③ 地址 + 载荷 → CRC16 校验(多项式 0x1021)
     ④ PAN1026 白化(信道 0x3F)
     ⑤ BLE 白化(信道 37/38/39)
         ↓
     ⑥ 输出 actPayload = [3 + 地址长度 + 载荷长度 + 2] 字节
     ↓
  4. BLE 广播：broadcastOnce(actPayload, 3000ms) ← beacon/index.js
     ├─ startAdvertising(actPayload)
     │   ├─ 将 int8[] 转为 ArrayBuffer
     │   └─ server.startAdvertising({
     │        manufacturerData: [{
     │          manufacturerId: '0x00C7',  // Panchip 厂商ID
     │          manufacturerSpecificData: 编码后的Buffer
     │        }],
     │        connectable: false
     │      })
     │   → 微信小程序以 BLE 外设模式广播
     │   → 附近设备扫描到 Company: 0x00C7 的广播包
     └─ 3秒后 → stopAdvertising() 自动停止
     ↓
  5. 阀门侧 PAN1026 接收
     ├─ BLE 扫描过滤 0x00C7 厂商数据
     ├─ 反向白化解码
     ├─ CRC16 校验
     ├─ 检查地址是否匹配
     └─ 提取 RF 载荷 → 解析为指令 → 执行阀门控制
```

## 文件职责

| 文件 | 职责 |
|------|------|
| `src/services/protocol/old-valve.js` | 生成 16 字节命令帧，包含流水号递增 |
| `src/services/beacon/bleUtil.js` | PAN1026 广播包编码（前导码+地址+CRC+白化） |
| `src/services/beacon/whitening.js` | 两级白化（0x3F + BLE 信道） |
| `src/services/beacon/crc16.js` | CRC16 校验（多项式 0x1021，含位反转） |
| `src/services/beacon/index.js` | BLE 外设服务封装（init → broadcastOnce → stop） |
| `src/pages/broadcast/index.mpx` | 广播控制页面 UI + 指令发送入口 |

## 协议帧格式（旧阀 - 智能调节阀）

```
16字节定长帧，不足补 0xFF

Byte 0: 帧头 = (cmd << 4) | length
Byte 1: 子命令 = (sub_cmd << 4) | seq(流水号)
Byte 2+: 数据域
Byte 15: 剩余补 0xFF
```

| 类别 | sub_cmd | 说明 |
|------|---------|------|
| 设备维护(cmd=1) | 0x1/0x2/0x3 | 自检/复位/重启 |
| 开度控制(cmd=2) | 0x1 | 设定开度 |
| 参数设置(cmd=2) | 0x2~0x9 | 模式/限值/补偿/周期等 |
| 查询(cmd=3) | 0x1 | 查询页面1 |

流水号从 2 开始递增，每次进入广播页或清空日志时重置。

## PAN1026 编码细节

输入：设备地址(3-5字节) + RF载荷(命令帧 16 字节)

1. 组装帧：`0x71 0x0F 0x55` + address(倒序) + rf_payload
2. invert_8：前 3+address_len 字节逐位反转
3. CRC16：address + rf_payload 计算 CRC（poly 0x1021）
4. PAN1026 白化：信道 0x3F，作用于 address + rf_payload + CRC
5. BLE 白化：信道 37/38/39，作用于完整数据
6. 输出：3 + address_len + rf_payload_len + 2 字节

## BLE 广播参数

- 模式：BLE 外设（peripheral），不可连接（connectable: false）
- 厂商 ID：`0x00C7`（Panchip Microelectronics）
- 发射功率：high
- 广播时长：3秒后自动停止
- 设备名称：空（不广播 local name）

## 与 BLE GATT 连接模式的区别

| 特性 | 广播模式（当前） | 蓝牙模式（控制页） |
|------|----------------|-------------------|
| 小程序角色 | BLE 外设（广播者） | BLE 中心（连接者） |
| 通信方式 | 广播 manufacturerData | GATT characteristic 写入 |
| 连接状态 | 不连接 | 需要连接 |
| 适用场景 | 快速控制、批量控制 | 双向通信、参数读取 |
| 编码方式 | PAN1026 协议（CRC+白化） | 直接发送 16 字节帧 |
| 响应反馈 | 无（单向广播） | 通过 notify 接收回复 |
