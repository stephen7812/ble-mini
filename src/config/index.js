/**
 * 接口地址。取自 .env 的 VUE_APP_API_BASE_URL，构建时由 DefinePlugin 替换成字面量。
 *
 * 兜底成本地而不是线上：忘了配变量时，请求打到本地会立刻失败并被发现；
 * 兜底成线上则会让一个配置错误的开发包安静地读写生产数据。
 */
const RAW_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://127.0.0.1:8090'

/** 去掉尾部斜杠，让调用方可以无脑写 BASE_URL + '/tenant/xxx' */
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '')
