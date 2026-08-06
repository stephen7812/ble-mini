import { buildHeaders } from './auth'
import { API_BASE_URL } from '../../config/index'

// 原来是空串（同域相对路径）。小程序的 wx.request 不接受相对地址，那等于这几个
// 接口一直是死的。现在统一从配置读，避免两套地址来源。
// 注意：/api/v1/data/** 是黑蚂蚁云的原始路径，需要 js-api 侧提供同名转发才通。
const BASE_URL = API_BASE_URL

export function getRealtimeData(nodeId, appId, appKey) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/api/v1/data/Dx/getRealtime`,
      method: 'GET',
      header: buildHeaders(appId, appKey),
      data: { page: 1, pageSize: -1, projectId: appId },
      success: (res) => resolve(res.data),
      fail: reject,
    })
  })
}

export function getHistoryData(nodeId, start, end, appId, appKey) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/api/v1/data/Dx/getHisTime`,
      method: 'GET',
      header: buildHeaders(appId, appKey),
      data: { page: 1, pageSize: -1, projectId: appId, nodeId, timeStart: start, timeEnd: end },
      success: (res) => resolve(res.data),
      fail: reject,
    })
  })
}

export function setDeviceParams(params, appId, appKey) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/api/v1/data/Vx/setDeviceDataParamApi`,
      method: 'POST',
      header: buildHeaders(appId, appKey),
      data: params,
      success: (res) => resolve(res.data),
      fail: reject,
    })
  })
}
