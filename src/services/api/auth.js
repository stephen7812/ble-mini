import md5 from '../../utils/md5'

export function buildHeaders(appId, appKey) {
  const now = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  const ts = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) +
    pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds())
  const authStr = appId + ':' + ts
  const buf = new Uint8Array(authStr.length)
  for (let i = 0; i < authStr.length; i++) buf[i] = authStr.charCodeAt(i)
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json;charset=utf-8',
    AccessToken: md5(appId + appKey + ts),
    Authorization: wx.arrayBufferToBase64(buf.buffer),
  }
}
