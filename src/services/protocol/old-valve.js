export const OLD_VALVE = { type: '智能调节阀', typeId: 'old' }

// 16字节定长帧：帧头(1) + 子命令(1) + 数据域(14)，不足补0xFF
let _seq = 2
function nextSeq() { const s = _seq; _seq = (_seq + 1) & 0x0F; return s }
export function resetSeq() { _seq = 2 }

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

// 响应帧：帧头(1) + 数据域(15)，无子命令字节
export function parseResponse(frame) {
  const buf = new Uint8Array(frame)
  if (buf.length < 2) return null
  const cmd = (buf[0] >> 4) & 0x0F
  const len = buf[0] & 0x0F
  const data = buf.slice(1, 1 + len)
  if (cmd === 0x3) return parsePage1Response(data)
  return { cmd, raw: Array.from(data) }
}

function parsePage1Response(data) {
  if (data.length < 15) return null
  const heatPeriodRaw = (data[10] << 16) | (data[9] << 8) | data[8]
  return {
    type: '智能调节阀',
    workMode: modeMap[data[0]] || '未知',
    valveOpening: data[1],
    targetOpening: data[2],
    openingUpper: data[3],
    openingLower: data[4],
    sampleCycle: data[5] * 10,
    reportCycle: data[6] * 10,
    reportCycleOff: data[7],
    heatPeriodStart: { year: Math.floor((heatPeriodRaw & 0xFFF) / 100), month: (heatPeriodRaw & 0xFFF) % 100 },
    heatPeriodEnd: { year: Math.floor((heatPeriodRaw >> 12) / 100), month: ((heatPeriodRaw >> 12) % 100) },
    inletTemp: parseTemp(data.slice(11, 13)),
    returnTemp: parseTemp(data.slice(13, 15)),
  }
}

function parseTemp(bytes) {
  if (bytes.length < 2) return 0
  const raw = (bytes[1] << 8) | bytes[0]
  const sign = (raw >> 15) & 1 ? -1 : 1
  return sign * (raw & 0x7FFF) / 100
}

function encodeTemp(tempC) {
  const absVal = Math.round(Math.abs(tempC) * 100) & 0x7FFF
  const raw = tempC >= 0 ? absVal : (absVal | 0x8000)
  return [raw & 0xFF, (raw >> 8) & 0xFF]
}

const modeMap = {
  0x81: '通断阀模式', 0x82: '智能调节-回水温度',
  0x83: '智能调节-室内温度', 0x84: '流量平衡阀模式',
  0x89: '停止模式',
}

export const OLD_COMMANDS = {
  deviceSelfCheck: () => buildFrame(0x1, 0x1),
  deviceReset: () => buildFrame(0x1, 0x2),
  deviceRestart: () => buildFrame(0x1, 0x3),
  setOpening: (pct) => buildFrame(0x2, 0x1, [pct]),
  setWorkMode: (mode) => buildFrame(0x2, 0x2, [mode]),
  setOpeningLimits: (upper, lower) => buildFrame(0x2, 0x3, [upper, lower]),
  setTempCompensation: (inletC, returnC, panelC) =>
    buildFrame(0x2, 0x4, [...encodeTemp(inletC), ...encodeTemp(returnC), ...encodeTemp(panelC)]),
  setHeatPeriod: (startYYMM, endYYMM) =>
    buildFrame(0x2, 0x5, [startYYMM & 0xFF, (startYYMM >> 8) & 0xFF, endYYMM & 0xFF, (endYYMM >> 8) & 0xFF]),
  setReportCycle: (sampleMin, reportOnMin, reportOffDay) =>
    buildFrame(0x2, 0x7, [
      sampleMin & 0xFF, (sampleMin >> 8) & 0xFF,
      reportOnMin & 0xFF, (reportOnMin >> 8) & 0xFF,
      reportOffDay,
    ]),
  setReturnTemp: (tempC) => buildFrame(0x2, 0x8, encodeTemp(tempC)),
  setIndoorTemp: (tempC, targetC) =>
    buildFrame(0x2, 0x9, [...encodeTemp(tempC), ...encodeTemp(targetC)]),
  queryPage1: () => buildFrame(0x3, 0x1),
}
