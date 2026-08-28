import { defineStore } from '@mpxjs/pinia'

export const useDeviceStore = defineStore('device', {
  state: () => ({
    pairedDevices: [],
    currentDevice: null,
    isScanning: false,
    broadcastMode: false,
    broadcastHistory: [],
    broadcastMessage: '',
    darkMode: false,
    // 主题三档：light（银灰）/ dark（枪灰）/ darker（深黑）
    themeLevel: 'light',
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
    // 根节点 class：浅档空串 / 枪灰 dark / 深黑 dark darker（后者叠加，局部 .dark 补丁继续生效）
    themeClass: (state) =>
      state.themeLevel === 'darker' ? 'dark darker' : state.themeLevel === 'dark' ? 'dark' : '',
    themeIcon: (state) =>
      state.themeLevel === 'light' ? '☀️' : state.themeLevel === 'dark' ? '🌙' : '⬛',
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