export function whitening_init(index, reg) {
  reg[0] = 1
  for (let i = 1; i < 7; i++) reg[i] = (index >> (6 - i)) & 0x01
}

function whitening_output(reg) {
  const temp = reg[3] ^ reg[6]
  reg[3] = reg[2]
  reg[2] = reg[1]
  reg[1] = reg[0]
  reg[0] = reg[6]
  reg[6] = reg[5]
  reg[5] = reg[4]
  reg[4] = temp
  return reg[0]
}

export function whitenging_encode(data, length, reg) {
  for (let data_index = 0; data_index < length; data_index++) {
    let data_input = data[data_index]
    let data_bit = 0
    let data_output = 0
    for (let bit_index = 0; bit_index < 8; bit_index++) {
      data_bit = (data_input >> (bit_index)) & 0x01
      data_bit ^= whitening_output(reg)
      data_output += (data_bit << (bit_index))
    }
    if (data_output > 127) data_output = data_output - 256
    data[data_index] = data_output
  }
  return data
}
