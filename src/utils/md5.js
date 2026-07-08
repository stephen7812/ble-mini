export default function md5(str) {
  const hex = (v) => (v < 16 ? '0' : '') + v.toString(16)
  const utf8 = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c < 0x80) utf8.push(c)
    else if (c < 0x800) utf8.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F))
    else utf8.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F))
  }
  const lenBits = utf8.length * 8
  utf8.push(0x80)
  while ((utf8.length * 8) % 512 !== 448) utf8.push(0)
  for (let i = 0; i < 8; i++) utf8.push((lenBits >>> (i * 8)) & 0xFF)
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  const K = [0xD76AA478,0xE8C7B756,0x242070DB,0xC1BDCEEE,0xF57C0FAF,0x4787C62A,0xA8304613,0xFD469501,0x698098D8,0x8B44F7AF,0xFFFF5BB1,0x895CD7BE,0x6B901122,0xFD987193,0xA679438E,0x49B40821,0xF61E2562,0xC040B340,0x265E5A51,0xE9B6C7AA,0xD62F105D,0x02441453,0xD8A1E681,0xE7D3FBC8,0x21E1CDE6,0xC33707D6,0xF4D50D87,0x455A14ED,0xA9E3E905,0xFCEFA3F8,0x676F02D9,0x8D2A4C8A,0xFFFA3942,0x8771F681,0x6D9D6122,0xFDE5380C,0xA4BEEA44,0x4BDECFA9,0xF6BB4B60,0xBEBFBC70,0x289B7EC6,0xEAA127FA,0xD4EF3085,0x04881D05,0xD9D4D039,0xE6DB99E5,0x1FA27CF8,0xC4AC5665,0xF4292244,0x432AFF97,0xAB9423A7,0xFC93A039,0x655B59C3,0x8F0CCC92,0xFFEFF47D,0x85845DD1,0x6FA87E4F,0xFE2CE6E0,0xA3014314,0x4E0811A1,0xF7537E82,0xBD3AF235,0x2AD7D2BB,0xEB86D391]
  const rot = (n, b) => (n << b) | (n >>> (32 - b))
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476
  for (let i = 0; i < utf8.length; i += 64) {
    const w = new Array(16)
    for (let j = 0; j < 16; j++) w[j] = utf8[i + j * 4] | (utf8[i + j * 4 + 1] << 8) | (utf8[i + j * 4 + 2] << 16) | (utf8[i + j * 4 + 3] << 24)
    let a = h0, b = h1, c = h2, d = h3
    for (let j = 0; j < 64; j++) {
      let f, g
      if (j < 16) { f = (b & c) | (~b & d); g = j }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16 }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16 }
      else { f = c ^ (b | ~d); g = (7 * j) % 16 }
      const temp = d; d = c; c = b
      b = (b + rot((a + f + K[j] + w[g]) & 0xFFFFFFFF, S[j])) & 0xFFFFFFFF
      a = temp
    }
    h0 = (h0 + a) & 0xFFFFFFFF; h1 = (h1 + b) & 0xFFFFFFFF
    h2 = (h2 + c) & 0xFFFFFFFF; h3 = (h3 + d) & 0xFFFFFFFF
  }
  const toHex = (n) => hex((n >>> 0) & 0xFF) + hex((n >>> 8) & 0xFF) + hex((n >>> 16) & 0xFF) + hex((n >>> 24) & 0xFF)
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3)
}
