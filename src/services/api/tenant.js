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

// ==================== 设备监控 API ====================

/**
 * 获取单设备实时数据。
 *
 * 后端返回的压力值已转换为 MPa（保留 1 位小数），可直接显示。
 * 电池电量已转换为百分比，信号强度单位为 dBm。
 *
 * @param {string} sn 设备 SN
 * @returns {Promise<Object>} 实时数据
 * @example
 * const data = await getDeviceRealtime('TF20260001')
 * // data.data.intake_pressure 已是 MPa，如 0.35
 * // data.data.battery 已是百分比，如 92
 */
export function getDeviceRealtime(sn) {
  return request({
    url: `/tenant/monitor/realtime/${encodeURIComponent(sn)}`,
    method: 'GET'
  })
}

/**
 * 获取设备历史数据。
 *
 * @param {string} sn 设备 SN
 * @param {number} startTime 开始时间（秒级时间戳）
 * @param {number} endTime 结束时间（秒级时间戳）
 * @returns {Promise<Object>} 历史数据列表 { list: [...] }
 */
export function getDeviceHistory(sn, startTime, endTime) {
  return request({
    url: `/tenant/monitor/history?device_sn=${encodeURIComponent(sn)}&start_time=${startTime}&end_time=${endTime}`,
    method: 'GET'
  })
}

/**
 * 获取设备详情（包含配置参数）。
 *
 * @param {string} deviceSn 设备 SN
 * @returns {Promise<Object>} 设备详情
 */
export function getDeviceDetail(deviceSn) {
  return request({
    url: `/tenant/monitor/device-detail?deviceSn=${encodeURIComponent(deviceSn)}`,
    method: 'GET'
  })
}

// ==================== 设备控制 API ====================

/**
 * 获取设备可下发命令列表。
 *
 * 后端根据设备平台（华为/黑蚂蚁）和产品物模型返回可用命令。
 * 前端按返回的命令列表动态渲染控制界面。
 *
 * @param {string} deviceSn 设备 SN
 * @returns {Promise<Object>} 命令能力
 */
export function getDeviceCommands(deviceSn) {
  return request({
    url: `/tenant/control/commands?device_sn=${encodeURIComponent(deviceSn)}`,
    method: 'GET'
  })
}

/**
 * 创建控制任务。
 *
 * @param {number} deviceId 设备 ID（注意不是 SN）
 * @param {string} command 命令名称（如 'set_openness'）
 * @param {Object} params 命令参数（如 { openness: 50 }）
 * @returns {Promise<Object>} 任务 ID { id: 123 }
 */
export function createControlTask(deviceId, command, params) {
  return request({
    url: '/tenant/control/task/create',
    method: 'POST',
    data: { device_id: deviceId, command, params }
  })
}

/**
 * 执行控制任务。
 *
 * @param {number} taskId 任务 ID
 * @returns {Promise<Object>} 执行结果
 */
export function executeControlTask(taskId) {
  return request({
    url: `/tenant/control/task/execute/${taskId}`,
    method: 'POST'
  })
}

/**
 * 一步到位：创建并立即执行控制任务。
 *
 * 封装了创建+执行两个步骤，适用于即时控制场景。
 * 错误处理：创建失败直接抛出，执行失败也抛出（已包含后端错误信息）。
 *
 * @param {number} deviceId 设备 ID
 * @param {string} command 命令名称
 * @param {Object} params 命令参数
 * @returns {Promise<Object>} 执行结果
 * @example
 * // 调节开度至 50%
 * await sendControlCommand(123, 'set_openness', { openness: 50 })
 *
 * // 设定目标压力 0.4 MPa（注意：参数单位取决于后端要求，需确认是 MPa 还是 kPa）
 * await sendControlCommand(123, 'set_pressure', { pressure: 0.4 })
 */
export async function sendControlCommand(deviceId, command, params) {
  const { id } = await createControlTask(deviceId, command, params)
  return executeControlTask(id)
}

/**
 * 查询控制任务列表。
 *
 * @param {number} page 页码，默认 1
 * @param {number} pageSize 每页数量，默认 20
 * @param {number} status 任务状态过滤（0=待执行 1=执行中 3=失败 4=已取消），不传则查全部
 * @returns {Promise<Object>} 任务列表 { list: [...], total, page, page_size }
 */
export function getControlTaskList(page = 1, pageSize = 20, status) {
  const statusParam = status !== undefined ? `&status=${status}` : ''
  return request({
    url: `/tenant/control/task/list?page=${page}&page_size=${pageSize}${statusParam}`,
    method: 'GET'
  })
}

/**
 * 写设备属性（华为 IoTDA 平台专用）。
 *
 * 黑蚂蚁平台设备不支持此接口，需使用 sendControlCommand。
 *
 * @param {string} deviceSn 设备 SN
 * @param {string} serviceId 服务 ID（如 'pressure'）
 * @param {Object} properties 属性键值对（如 { pressure_upper: 400000 }）
 * @returns {Promise<Object>} 执行结果
 */
export function setDeviceProperty(deviceSn, serviceId, properties) {
  return request({
    url: '/tenant/control/property',
    method: 'POST',
    data: { device_sn: deviceSn, service_id: serviceId, properties }
  })
}

export { uploadImage, downloadFile, normalizeFileUrl }
