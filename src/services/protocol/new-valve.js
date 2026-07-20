export const NEW_VALVE = { type: '先导调节阀', typeId: 'new' }

// 帧格式与智能调节阀一致：byte1 高4位=子命令码S，低4位=通讯序号O(上位机顺序递增)。
// 设备靠序号区分「新指令」与「重复广播」；子命令必须落在高4位，否则设备识别为 0 号命令。
let _seq = 2
function nextSeq() { const s = _seq; _seq = (_seq + 1) & 0x0F; return s }
export function resetSeq() { _seq = 2 }

// 16字节定长帧：帧头(1) + 子命令/序号(1) + 数据域(不足补0xFF)
export function buildFrame(cmd, subCmd, data = []) {
  const length = (data?.length || 0) + 1
  const header = ((cmd & 0x0F) << 4) | (length & 0x0F)
  const buf = new Uint8Array(16)
  buf.fill(0xFF)
  buf[0] = header
  buf[1] = ((subCmd & 0x0F) << 4) | nextSeq()
  if (data?.length) buf.set(data, 2)
  return buf.buffer
}

function toInt8(v) {
  return v > 127 ? v - 256 : v
}

// 响应帧：帧头(1) + 数据域(15)，无子命令字节
export function parseResponse(frame) {
  const buf = new Uint8Array(frame)
  if (buf.length < 2) return null
  const cmd = (buf[0] >> 4) & 0x0F
  const len = buf[0] & 0x0F
  const data = buf.slice(1, 1 + len)
  switch (cmd) {
    case 0x3: return parsePage1Response(data)
    case 0x4: return parsePage2Response(data)
    default: return { cmd, raw: Array.from(data) }
  }
}

function parsePage1Response(data) {
  if (data.length < 15) return null
  return {
    type: '先导调节阀', page: 1,
    inletPressure: data[0] * 10,
    returnPressure: data[1] * 10,
    setPressure: data[2] * 10,
    inletCompensation: toInt8(data[3]),
    returnCompensation: toInt8(data[4]),
    returnPressureUpper: data[5] * 10,
    returnPressureLower: data[6] * 10,
    status: data[7],
    funcBits: data[8],
    valvePosition: data[9],
    targetPosition: data[10],
    positionUpper: data[11],
    positionLower: data[12],
    sampleCycle: data[13] * 10,
    reportCycle: data[14] * 10,
  }
}

function parsePage2Response(data) {
  if (data.length < 15) return null
  return {
    type: '先导调节阀', page: 2,
    timePressureEnabled: data[0] === 1,
    timeSlots: [
      { time: data[1] * 10, pressure: data[2] * 10 },
      { time: data[3] * 10, pressure: data[4] * 10 },
      { time: data[5] * 10, pressure: data[6] * 10 },
      { time: data[7] * 10, pressure: data[8] * 10 },
      { time: data[9] * 10, pressure: data[10] * 10 },
    ],
    inletPressureThreshold: (data[11] || 0) * 10,
    returnPressureThreshold: (data[12] || 0) * 10,
    batteryVoltage: ((data[13] || 0) + 300) * 10,
    signalStrength: data[14],
  }
}

export const NEW_COMMANDS = {
  deviceSelfCheck: () => buildFrame(0x1, 1),
  deviceReset: () => buildFrame(0x1, 2),
  deviceRestart: () => buildFrame(0x1, 3),
  syncValvePosition: (position) => buildFrame(0x2, 1, [position]),
  setTargetPressure: (pressure10KPa) => buildFrame(0x2, 2, [pressure10KPa]),
  setPositionLimits: (upper, lower) => buildFrame(0x2, 3, [upper, lower]),
  setPressureCompensation: (inlet, ret) => buildFrame(0x2, 4, [inlet, ret]),
  setTimePressure: (enabled, ...slots) =>
    buildFrame(0x2, 5, [enabled ? 1 : 0, ...slots]),
  setPressureLimits: (inletUpper, inletLower, returnUpper, returnLower) =>
    buildFrame(0x2, 6, [inletUpper, inletLower, returnUpper, returnLower]),
  setReportCycle: (sample10Min, reportOn10Min, reportOffDay) =>
    buildFrame(0x2, 7, [sample10Min, reportOn10Min, reportOffDay]),
  setPressureThreshold: (inlet10KPa, return10KPa) =>
    buildFrame(0x2, 8, [inlet10KPa, return10KPa]),
  queryPage1: () => buildFrame(0x3, 1),
  queryPage2: () => buildFrame(0x4, 1),
}
