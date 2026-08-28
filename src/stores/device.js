import { defineStore } from '@mpxjs/pinia'

/** 可用界面风格白名单：新增风格时在此登记 + app.mpx 加变量块 + 设置页加选项 */
export const THEME_STYLES = ['industrial', 'energy', 'blueprint']

/** 各风格各明暗档的导航栏底色（与 app.mpx 背景渐变的顶部色对齐） */
const NAV_BG = {
  industrial: { light: '#D7DBE1', dark: '#2A2D34', darker: '#1C1E23' },
  energy: { light: '#F2F6F3', dark: '#1C2B23', darker: '#121D17' },
  blueprint: { light: '#F4F7FB', dark: '#16233F', darker: '#0E1729' },
}

export const useDeviceStore = defineStore('device', {
  state: () => ({
    pairedDevices: [],
    currentDevice: null,
    isScanning: false,
    broadcastMode: false,
    broadcastHistory: [],
    broadcastMessage: '',
    darkMode: false,
    // 主题三档：light（浅色）/ dark（暗色）/ darker（深黑）
    themeLevel: 'light',
    // 界面风格：industrial（工业机械）/ energy（能源管道）/ blueprint（蓝图工程）
    themeStyle: 'industrial',
  }),
  getters: {
    deviceCount: (state) => state.pairedDevices.length,
    isConnected: (state) => !!state.currentDevice?.connected,
    currentDeviceMode: (state) => {
      const device = state.currentDevice
      return device && device.mode ? device.mode : 'bluetooth'
    },
    isBroadcastMode: (state) => {
      const device = state.currentDevice
      return device && device.mode ? device.mode === 'broadcast' : false
    },
    // 根节点 class：风格类 + 明暗档类拼装。
    // 深黑档同时挂 dark darker（.dark 打底让页面局部暗档补丁继续生效，.darker 覆盖变量）。
    themeClass: (state) => {
      const style = `theme-${state.themeStyle || 'industrial'}`
      const level = state.themeLevel === 'darker' ? 'dark darker' : state.themeLevel === 'dark' ? 'dark' : ''
      return `${style} ${level}`.trim()
    },
    themeIcon: (state) =>
      state.themeLevel === 'light' ? '☀️' : state.themeLevel === 'dark' ? '🌙' : '⬛',
    // 导航栏颜色：随风格 × 明暗档变化，页面 onShow 直接 wx.setNavigationBarColor(store.navBarColors)
    navBarColors: (state) => {
      const style = state.themeStyle || 'industrial'
      return {
        frontColor: state.themeLevel === 'light' ? '#000000' : '#ffffff',
        backgroundColor: (NAV_BG[style] || NAV_BG.industrial)[state.themeLevel] || NAV_BG[style].light,
      }
    },
  },
  actions: {
    loadHistory() {
      const raw = wx.getStorageSync('pairedDevices')
      if (raw) this.pairedDevices = raw
      const broadcastRaw = wx.getStorageSync('broadcastHistory')
      if (broadcastRaw) this.broadcastHistory = broadcastRaw
    },
    saveBroadcastHistory() {
      wx.setStorageSync('broadcastHistory', this.broadcastHistory)
    },
    loadDevices() {
      const raw = wx.getStorageSync('pairedDevices')
      if (raw) this.pairedDevices = raw
    },
    saveHistory() {
      wx.setStorageSync('pairedDevices', this.pairedDevices)
    },
    addDevice(device) {
      const idx = this.pairedDevices.findIndex(d => d.deviceId === device.deviceId)
      if (idx >= 0) {
        // 已有记录：合并最新信息、刷新时间并置顶，作为「最近使用」
        const merged = { ...this.pairedDevices[idx], ...device, lastSeen: Date.now() }
        this.pairedDevices.splice(idx, 1)
        this.pairedDevices.unshift(merged)
      } else {
        this.pairedDevices.unshift({ ...device, lastSeen: Date.now() })
      }
      this.saveHistory()
    },
    removeDevice(deviceId) {
      this.pairedDevices = this.pairedDevices.filter(d => d.deviceId !== deviceId)
      this.saveHistory()
    },
    setCurrentDevice(device) {
      this.currentDevice = device
    },
    setScanning(v) {
      this.isScanning = v
    },
    clearHistory() {
      this.pairedDevices = []
      wx.setStorageSync('pairedDevices', [])
    },
    loadDarkMode() {
      // 恢复界面风格（非法值回落工业风）
      const savedStyle = wx.getStorageSync('themeStyle')
      this.themeStyle = THEME_STYLES.indexOf(savedStyle) >= 0 ? savedStyle : 'industrial'
      // 新键 themeLevel 三档优先；旧布尔键 darkMode 兼容迁移（true → dark）
      const savedLevel = wx.getStorageSync('themeLevel')
      if (savedLevel === 'dark' || savedLevel === 'darker' || savedLevel === 'light') {
        this.themeLevel = savedLevel
      } else {
        this.themeLevel = wx.getStorageSync('darkMode') ? 'dark' : 'light'
      }
      this.darkMode = this.themeLevel !== 'light'
    },
    // 沿用旧名：现在是三档循环 light → dark → darker → light
    toggleDarkMode() {
      const order = ['light', 'dark', 'darker']
      this.setThemeLevel(order[(order.indexOf(this.themeLevel) + 1) % order.length])
    },
    setThemeLevel(level) {
      this.themeLevel = level
      this.darkMode = level !== 'light'
      wx.setStorageSync('themeLevel', level)
      // 同步旧键，回滚到旧版本小程序时主题不丢
      wx.setStorageSync('darkMode', this.darkMode)
    },
    // 切换界面风格（industrial / energy / blueprint），持久化后全 app 生效
    setThemeStyle(style) {
      if (THEME_STYLES.indexOf(style) < 0) return
      this.themeStyle = style
      wx.setStorageSync('themeStyle', style)
    },
    setBroadcastMode(v) {
      this.broadcastMode = v
    },
    setBroadcastMessage(m) {
      this.broadcastMessage = m
    },
    addBroadcastRecord(record) {
      this.broadcastHistory.unshift(record)
      this.saveBroadcastHistory()
    },
    clearBroadcastHistory() {
      this.broadcastHistory = []
      wx.setStorageSync('broadcastHistory', [])
    },
  },
})