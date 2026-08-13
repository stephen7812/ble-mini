import { API_BASE_URL } from '../../config/index'

const AUTH_KEY = 'tenant_auth'

function readAuth() {
  try {
    return wx.getStorageSync(AUTH_KEY) || null
  } catch (e) {
    return null
  }
}

function writeAuth(auth) {
  try {
    wx.setStorageSync(AUTH_KEY, auth)
  } catch (e) {
    // 存不进去不影响本次请求，下次启动会退回登录页
  }
}

function clearAuth() {
  try {
    wx.removeStorageSync(AUTH_KEY)
  } catch (e) {
    // 清不掉也只是留了一份过期数据，下次请求照样会被 401 打回登录页
  }
}

/** 裸的一次请求。不做任何鉴权处理，续期逻辑要靠它避免递归 */
function rawRequest({ url, method = 'GET', data, header = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE_URL + url,
      method,
      data,
      header: { 'content-type': 'application/json', ...header },
      success: (res) => resolve(res),
      fail: () => reject(new Error('网络连接失败，请检查网络后重试')),
    })
  })
}

/**
 * 判断这次失败是不是「token 不认了」。
 *
 * 只认 HTTP 状态码，不认 body.code —— 后端全站的业务错误都是 HTTP 200 + body.code，
 * 只有 authMiddleware 拒绝 token 时才回真正的 HTTP 401。
 * 而登录接口在密码错误时返回的正是 body.code === 401（HTTP 200），
 * 若按 body.code 判，输错密码会被当成「登录过期」，用户看到的提示牛头不对马嘴。
 *
 * body.code 在这里的取值是 40100/40101/40102（未登录 / 已过期 / 无效），
 * 也不是 401，顺带说明按 body.code 判根本判不中。
 */
function isAuthFailure(res) {
  return res.statusCode === 401
}

/**
 * 用 refresh token 换一对新 token。失败返回 null，由调用方决定怎么处理。
 *
 * 请求体与响应体都是 snake_case 的 refresh_token（后端 /tenant/login/refresh 的字段名），
 * 本地缓存里则统一存 camelCase，蛇形只出现在这一层边界上。
 */
async function refreshToken() {
  const auth = readAuth()
  if (!auth || !auth.refreshToken) return null

  const res = await rawRequest({
    url: '/tenant/login/refresh',
    method: 'POST',
    data: { refresh_token: auth.refreshToken },
  })

  const body = res.data || {}
  if (body.code !== 200 || !body.data) return null

  const next = {
    ...auth,
    token: body.data.token,
    refreshToken: body.data.refresh_token || auth.refreshToken,
  }
  writeAuth(next)
  return next.token
}

/**
 * 业务请求。
 *
 * 约定：业务成败一律 HTTP 200 + body.code。所以这里把非 200 的 code
 * 统一转成 reject，页面里只需要 try/catch 一次，不用每处判 code。
 * 抛出的 Error 上带 code，让个别页面能对 403/404 做定制处理（比如扫码页要按
 * 三态给不同文案）。
 */
export async function request(options, _retried = false) {
  const auth = readAuth()
  // 后端 authMiddleware 同时认 Token 头与 Authorization: Bearer，这里用后者
  const header = auth && auth.token ? { Authorization: `Bearer ${auth.token}` } : {}

  const res = await rawRequest({ ...options, header: { ...header, ...(options.header || {}) } })
  const body = res.data || {}

  if (isAuthFailure(res)) {
    if (!_retried) {
      // 只重试一次：续期本身也可能失败（refresh token 也过期了），
      // 不设这个开关就是无限递归。
      const token = await refreshToken()
      if (token) return request(options, true)
    }
    // 续不上（或续完再试还是 401）就别挣扎了，清掉登录态让人重新登录
    clearAuth()
    const err = new Error('登录已过期，请重新登录')
    err.code = 401
    throw err
  }

  if (body.code !== 200) {
    const err = new Error(body.message || '请求失败')
    err.code = body.code
    throw err
  }

  return body.data
}

/** 上传走 wx.uploadFile，走不了 wx.request，所以单独开一个但共用 token 读取 */
export function uploadImage(filePath, sn) {
  const auth = readAuth()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/tenant/uploads/image`,
      filePath,
      // 后端读的是 parseBody()['file']，字段名必须是 file
      name: 'file',
      formData: sn ? { sn } : {},
      header: auth && auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      success: (res) => {
        // uploadFile 的 data 是字符串，得自己解析
        let body = {}
        try {
          body = JSON.parse(res.data)
        } catch (e) {
          reject(new Error('上传失败'))
          return
        }
        if (body.code !== 200 || !body.data || !body.data.url) {
          reject(new Error(body.message || '上传失败'))
          return
        }
        resolve(body.data.url)
      },
      fail: () => reject(new Error('上传失败，请检查网络')),
    })
  })
}

/**
 * 把后端返回的文件 URL 归一到当前 API 地址。
 *
 * 背景：install_photos 存的是上传时用 config.upload.baseUrl 拼的绝对 URL，
 * 而 baseUrl 的兜底是硬编码的 http://jsapi.site —— 环境变量没配、或部署域名
 * 变更后，库里旧 URL 的 host 就指向一个死地址，真机加载/下载全部失败。
 * 文件本就由 API 服务器的 /upload/ 静态目录提供，所以展示和下载前把 origin
 * 统一换成 API_BASE_URL 的 origin；只认 /upload/ 开头的自家路径，外链原样放行。
 */
export function normalizeFileUrl(url) {
  if (!url) return url
  if (url.charAt(0) === '/') return API_BASE_URL + url
  const m = /^https?:\/\/[^/]+(\/upload\/.*)$/.exec(url)
  if (m) return API_BASE_URL + m[1]
  return url
}

/**
 * 从服务端 URL 下载文件到本地临时路径。
 * 解决真机预览时 <image> 组件无法直接加载 HTTP 图片的问题。
 */
export function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: normalizeFileUrl(url),
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath)
        } else {
          reject(new Error('下载失败'))
        }
      },
      fail: () => reject(new Error('下载失败，请检查网络')),
    })
  })
}

export { AUTH_KEY, readAuth, writeAuth, clearAuth }
