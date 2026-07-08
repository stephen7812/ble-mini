import { buildHeaders } from './auth'

const BASE_URL = ''

export function getRealtimeData(nodeId, appId, appKey) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/api/v1/data/Vx/getRealtimeTwo`,
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
      url: `${BASE_URL}/api/v1/data/Vx/getHisTime`,
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
