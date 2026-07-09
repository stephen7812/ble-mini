export function invert_8(data) {
  let temp = 0
  for (let i = 0; i < 8; i++) {
    if (data & (1 << i)) temp |= 1 << (7 - i)
  }
  return temp >= 128 ? temp - 256 : temp
}

export function invert_16(data) {
  let temp = 0
  for (let i = 0; i < 16; i++) {
    if (data & (1 << i)) temp |= 1 << (15 - i)
  }
  return temp
}

export function check_crc16(addr, addr_length, rf_payload, payload_width) {
  let crc = 0xFFFF
  const poly = 0x1021
  let input_byte = 0

  for (let i = 0; i < addr_length; i++) {
    input_byte = addr[addr_length - 1 - i]
    crc ^= (input_byte << 8)
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ poly
      else crc = (crc << 1)
    }
  }

  for (let i = 0; i < payload_width; i++) {
    input_byte = invert_8(rf_payload[i])
    crc ^= (input_byte << 8)
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ poly
      else crc = (crc << 1)
    }
  }
  crc = invert_16(crc)
  return (crc ^ 0xFFFF)
}
