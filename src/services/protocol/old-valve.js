export const OLD_VALVE = { type: '智能调节阀', typeId: 'old' }

export function buildFrame(cmd, subCmd, data = []) {
  const length = (data?.length || 0) + 1
  const header = ((cmd & 0x0F) << 4) | (length & 0x0F)
  const sub = ((subCmd & 0x0F) << 4) | 0
  const buf = new Uint8Array(2 + (data?.length || 0))
  buf[0] = header; buf[1] = sub
  if (data?.length) buf.set(data, 2)
  return buf.buffer
}

export function parseResponse(frame) {
  const buf = new Uint8Array(frame)
  if (buf.length < 2) return null
  const cmd = (buf[0] >> 4) & 0x0F
  const subCmd = (buf[1] >> 4) & 0x0F
  const data = buf.slice(2)
  if (cmd === 0x3) return parsePage1Response(data)
  return { cmd, subCmd, raw: Array.from(data) }
}

function parsePage1Response(data) {
  if (data.length < 12) return null
  return {
    type: '智能调节阀', workMode: modeMap[data[0]] || '未知',
    valveOpening: data[1], targetOpening: data[2],
    openingUpper: data[3], openingLower: data[4],
    sampleCycle: data[5] * 10, reportCycle: data[6] * 10,
    reportCycleOff: data[7],
    inletTemp: parseTemp(data.slice(8, 10)),
    returnTemp: parseTemp(data.slice(10, 12)),
  }
}

function parseTemp(bytes) {
  if (bytes.length < 2) return 0
  const raw = (bytes[1] << 8) | bytes[0]
  const sign = (raw >> 15) & 1 ? -1 : 1
  return sign * (raw & 0x7FFF) / 100
}

const modeMap = { 0x81: '通断阀模式', 0x82: '智能调节-回水温度', 0x83: '智能调节-室内温度', 0x84: '流量平衡阀模式', 0x89: '停止模式' }

export const OLD_COMMANDS = {
  deviceSelfCheck: () => buildFrame(0x1, 0x1),
  deviceReset: () => buildFrame(0x1, 0x2),
  deviceRestart: () => buildFrame(0x1, 0x3),
  setOpening: (pct) => buildFrame(0x2, 0x1, [pct]),
  setWorkMode: (mode) => buildFrame(0x2, 0x2, [mode]),
  setOpeningLimits: (upper, lower) => buildFrame(0x2, 0x3, [upper, lower]),
  setReportCycle: (sampleMin, reportMin, reportDay) => buildFrame(0x2, 0x7, [sampleMin, reportMin, reportDay]),
  queryPage1: () => buildFrame(0x3, 0x1),
}
