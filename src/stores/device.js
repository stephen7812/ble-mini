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
      const exists = this.pairedDevices.find(d => d.deviceId === device.deviceId)
      if (!exists) {
        this.pairedDevices.unshift({ ...device, lastSeen: Date.now() })
        this.saveHistory()
      }
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
      this.darkMode = !!wx.getStorageSync('darkMode')
    },
    toggleDarkMode() {
      this.darkMode = !this.darkMode
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