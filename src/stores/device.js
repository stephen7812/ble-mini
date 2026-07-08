import { defineStore } from '@mpxjs/pinia'

export const useDeviceStore = defineStore('device', {
  state: () => ({
    pairedDevices: [],
    currentDevice: null,
    isScanning: false,
  }),
  getters: {
    deviceCount: (state) => state.pairedDevices.length,
    isConnected: (state) => !!state.currentDevice?.connected,
  },
  actions: {
    loadHistory() {
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
  },
})
