export const NEW_VALVE = { type: '先导调节阀', typeId: 'new' }

export function buildFrame(cmd, subCmd, data = []) {
  const length = (data?.length || 0) + 1
  const header = ((cmd & 0x0F) << 4) | (length & 0x0F)
  const payload = new Uint8Array(1 + (data?.length || 0))
  payload[0] = subCmd
  if (data?.length) payload.set(data, 1)
  const buf = new Uint8Array(1 + payload.length)
  buf[0] = header; buf.set(payload, 1)
  return buf.buffer
}

export function parseResponse(frame) {
  const buf = new Uint8Array(frame)
  if (buf.length < 2) return null
  const cmd = (buf[0] >> 4) & 0x0F
  const subCmd = buf[1]
  const data = buf.slice(2)
  switch (cmd) {
    case 0x3: return parsePage1Response(data)
    case 0x4: return parsePage2Response(data)
    default: return { cmd, subCmd, raw: Array.from(data) }
  }
}

function parsePage1Response(data) {
  if (data.length < 16) return null
  return {
    type: '先导调节阀', page: 1,
    inletPressure: data[0] * 10, returnPressure: data[1] * 10,
    setPressure: data[2] * 10, inletCompensation: data[3],
    returnCompensation: data[4], pressureUpper: data[5] * 10,
    pressureLower: data[6] * 10, status: data[7],
    funcBits: data[8], moduleFuncBits: data[9],
    valvePosition: data[10], targetPosition: data[11],
    positionUpper: data[12], positionLower: data[13],
    sampleCycle: data[14] * 10, reportCycle: data[15] * 10,
  }
}

function parsePage2Response(data) {
  if (data.length < 17) return null
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
  setPressureCompensation: (inlet, ret) => buildFrame(0x2, 4, [inlet & 0xFF, ret & 0xFF]),
  setTimePressure: (enabled, ...slots) => buildFrame(0x2, 5, [enabled ? 1 : 0, ...slots]),
  setPressureLimits: (upper, lower) => buildFrame(0x2, 6, [upper, lower]),
  setReportCycle: (sample, report) => buildFrame(0x2, 7, [sample, report]),
  queryPage1: () => buildFrame(0x3, 1),
  queryPage2: () => buildFrame(0x4, 1),
}
