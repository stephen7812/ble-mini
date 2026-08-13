import { request, uploadImage, downloadFile, normalizeFileUrl } from './http'

/**
 * 租户登录。
 *
 * 路径是 /tenant/login/index 不是 /tenant/login —— 后端把登录挂在
 * app.route('/tenant/login', ...) 下的 app.post('/index')，少写 /index 会 404。
 *
 * 返回的 data 里 refresh_token 是蛇形，token / user / tenant 是驼峰，
 * 归一化交给 auth store 做，这一层只管把后端原样吐出来。
 */
export function login(username, password) {
  return request({ url: '/tenant/login/index', method: 'POST', data: { username, password } })
}

/**
 * 扫码后按 SN 查设备。
 *
 * 失败时抛出的 Error 带 code：404「设备不存在」、403「设备与账户不匹配」
 * 或 403「设备尚未分配租户」。后端刻意区分这三态，页面必须原样展示 message，
 * 不要合并成一句「查询失败」—— 扫码的人手里攥着实物设备，
 * 回「不存在」只会让他反复重扫。
 */
export function getDeviceBySn(sn) {
  return request({ url: `/tenant/device/by-sn?sn=${encodeURIComponent(sn)}`, method: 'GET' })
}

/**
 * 保存设备信息。需要调用者具备 installer 角色，
 * 否则后端返回 { code: 403, message: '无权编辑设备信息' }。
 * payload 必须带 id；install_time 是秒级时间戳，install_photos 是 URL 数组（最多 3 张）。
 */
export function updateDevice(payload) {
  return request({ url: '/tenant/device/update', method: 'POST', data: payload })
}

/** 小区下拉选项。后端不分页，返回 { list: [...] } */
export function getCommunityOptions(keywords = '') {
  return request({ url: `/tenant/community/options?keywords=${encodeURIComponent(keywords)}`, method: 'GET' })
}

/**
 * 按尾号搜索设备。返回列表，每项包含 id、sn、name、community 等字段。
 * 用于首页手动输入设备尾号匹配的场景。
 */
export function searchDevices(keyword) {
  return request({ url: `/tenant/device/list?keyword=${encodeURIComponent(keyword)}&page_size=20`, method: 'GET' })
}

export { uploadImage, downloadFile, normalizeFileUrl }
