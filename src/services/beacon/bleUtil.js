import { whitening_init, whitenging_encode } from './whitening'
import { invert_8, check_crc16 } from './crc16'

function hexToBytes(str) {
  str = str.replace(/\s+/g, '').toLowerCase()
  if (str.length % 2 !== 0) return null
  const bytes = []
  for (let i = 0; i < str.length; i += 2) {
    let v = parseInt(str.substr(i, 2), 16)
    if (v >= 127) v = v - 256
    bytes.push(v)
  }
  return bytes
}

function get_1rf_1payload(address, address_length, rf_payload, rf_payload_width) {
  const base_size = 15
  const channel = wx.getStorageSync('channel') || '37'
  const whitening_reg_ble = new Array(7)
  whitening_reg_ble[0] = 0
  const whitening_reg_297 = new Array(7)
  whitening_reg_297[0] = 0

  whitening_init(Number(channel), whitening_reg_ble)
  whitening_init(0x3F, whitening_reg_297)

  let ble_payload = new Array(base_size + 3 + address_length + rf_payload_width + 2)

  ble_payload[base_size + 0] = 0x71
  ble_payload[base_size + 1] = 0x0F
  ble_payload[base_size + 2] = 0x55
  for (let i = 0; i < address_length; i++) {
    ble_payload[base_size + 3 + i] = address[address_length - i - 1]
  }
  for (let i = 0; i < rf_payload_width; i++) {
    ble_payload[base_size + 3 + address_length + i] = rf_payload[i]
  }

  for (let i = 0; i < 3 + address_length; i++) {
    ble_payload[base_size + i] = invert_8(ble_payload[base_size + i])
  }

  let crc = check_crc16(address, address_length, rf_payload, rf_payload_width)
  ble_payload[base_size + 3 + address_length + rf_payload_width + 0] = crc & 0xFF
  ble_payload[base_size + 3 + address_length + rf_payload_width + 1] = (crc >> 8) & 0xFF

  const wData = whitenging_encode(ble_payload.slice(base_size + 3), address_length + rf_payload_width + 2, whitening_reg_297)
  for (let i = 0; i < wData.length; i++) {
    ble_payload[base_size + 3 + i] = wData[i]
  }

  whitenging_encode(ble_payload, base_size + 3 + address_length + rf_payload_width + 2, whitening_reg_ble)

  const act_payload = new Array(3 + address_length + rf_payload_width + 2)
  for (let i = 0; i < 3 + address_length + rf_payload_width + 2; ++i) {
    act_payload[i] = ble_payload[i + base_size]
  }
  return act_payload
}

export function generateData(inputPayload) {
  let rawAddress = wx.getStorageSync('address') || ''
  rawAddress = rawAddress.replace(/\s+/g, '').toLowerCase()
  if (rawAddress.length < 6 || rawAddress.length > 10) {
    wx.showToast({ icon: 'none', title: '请先设置设备地址' })
    return null
  }
  return generateDataWithAddr(rawAddress, inputPayload)
}

export function generateDataWithAddr(rawAddress, inputPayload) {
  const address = hexToBytes(rawAddress)
  if (!address || address.length < 3 || address.length > 5) {
    wx.showToast({ icon: 'none', title: '地址长度错误(3-5字节)' })
    return null
  }
  let payload = inputPayload.replace(/\s+/g, '').toLowerCase()
  if (payload.length < 2 || payload.length % 2 !== 0) {
    wx.showToast({ icon: 'none', title: 'payload长度错误' })
    return null
  }
  const rf_payload = hexToBytes(payload)
  return get_1rf_1payload(address, address.length, rf_payload, rf_payload.length)
}

export function actPayloadToBuffer(actPayload) {
  const buf = new ArrayBuffer(actPayload.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < actPayload.length; i++) {
    view[i] = actPayload[i] < 0 ? actPayload[i] + 256 : actPayload[i]
  }
  return buf
}
