import { defineStore } from '@mpxjs/pinia'
import { AUTH_KEY, clearAuth, readAuth, writeAuth } from '../services/api/http'
import { login as loginApi } from '../services/api/tenant'

/** 空用户。抽出来是为了 state / logout / loadAuth 三处兜底完全一致 */
function emptyUser() {
  return { id: 0, username: '', realname: '', roles: [] }
}

function emptyTenant() {
  return { id: 0, name: '' }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    refreshToken: '',
    // roles 是登录时后端给的快照。改了角色要重新登录才生效 —— 规格 §3.9.1 的取舍。
    user: emptyUser(),
    tenant: emptyTenant(),
  }),

  getters: {
    isLogged: (state) => Boolean(state.token),
    /** 能否编辑设备安装信息。后端 /tenant/device/update 也拦一道，这里只是不让人白填一屏 */
    canInstall: (state) => (state.user.roles || []).includes('installer'),
    /** 能否进入蓝牙调试。规格 §3.9.1：蓝牙不经过接口，这只是功能开关，不是安全边界 */
    canDebug: (state) => (state.user.roles || []).includes('debugger'),
  },

  actions: {
    /**
     * 从本地缓存恢复登录态。不校验 token 是否还有效 ——
     * 校验意味着启动时必须联网，而安装人员经常在信号差的机房里开小程序。
     * token 真过期了，第一次发请求时的 401 会把人送回登录页。
     */
    loadAuth() {
      const auth = readAuth()
      if (!auth) return
      this.token = auth.token || ''
      this.refreshToken = auth.refreshToken || ''
      this.user = auth.user || emptyUser()
      this.tenant = auth.tenant || emptyTenant()
    },

    /**
     * 账号密码登录。
     *
     * 后端返回的 refresh_token 是蛇形，这里归一化成 refreshToken 再落盘：
     * 缓存里的形状必须和 http.js 续期时读的形状一致，两边不一致就是「续期永远续不上」。
     */
    async login(username, password) {
      const data = await loginApi(username, password)
      const auth = {
        token: data.token,
        refreshToken: data.refresh_token || '',
        user: {
          id: data.user.id,
          username: data.user.username,
          // 编辑页拿它做「安装人」的默认值，没有 realname 的员工账号退回用户名
          realname: data.user.realname || data.user.username || '',
          roles: data.user.roles || [],
        },
        tenant: {
          id: (data.tenant && data.tenant.id) || 0,
          name: (data.tenant && data.tenant.name) || '',
        },
      }
      writeAuth(auth)
      this.token = auth.token
      this.refreshToken = auth.refreshToken
      this.user = auth.user
      this.tenant = auth.tenant
    },

    logout() {
      clearAuth()
      this.token = ''
      this.refreshToken = ''
      this.user = emptyUser()
      this.tenant = emptyTenant()
    },
  },
})

export { AUTH_KEY }
