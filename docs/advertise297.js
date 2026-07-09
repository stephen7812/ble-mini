const app = getApp()
import { ab2hex, inArray } from "../../utils/util"
import { generateData, getServiceUUIDs } from "../../utils/BLEUtil"
const cacheManager = require('../../utils/cacheManager');

const CONSTANTS = {
  FILTER_NAME: 'ANTS',
  DEFAULT_KAIDU: 50,
  DEFAULT_UP_TYPE: 1,
  CMD_LENGTH: 32,
  MANUFACTURER_ID: '0x00C7',
  READ_STATUS_CMD: { PAGE1: '311', PAGE2: '312A' },
  STATUS_PARSE: {
    PAGE1: [
      { key: 'frameHeader', label: '帧头', start: 0, end: 2, parser: v => v },
      { key: 'workMode', label: '工作模式', start: 2, end: 4, parser: v => v },
      { key: 'valveOpenness', label: '阀门开度', start: 4, end: 6, parser: v => `${parseInt(v, 16)}%` },
      { key: 'valveSetOpenness', label: '设定开度', start: 6, end: 8, parser: v => `${parseInt(v, 16)}%` },
      { key: 'valveMaxOpenness', label: '开度上限', start: 8, end: 10, parser: v => `${parseInt(v, 16)}%` },
      { key: 'valveMinOpenness', label: '开度下限', start: 10, end: 12, parser: v => `${parseInt(v, 16)}%` },
      { key: 'sampleCycle', label: '采样周期', start: 12, end: 14, parser: v => `${parseInt(v, 16)}×10分钟` },
      { key: 'reportCycleHeating', label: '供暖上报周期', start: 14, end: 16, parser: v => `${parseInt(v, 16)}×10分钟` },
      { key: 'reportCycleNonHeating', label: '非供暖上报周期', start: 16, end: 18, parser: v => `${parseInt(v, 16)}天` },
      { key: 'inletTemp', label: '进水温度', start: 24, end: 28, parser: parseTemperature },
      { key: 'returnTemp', label: '回水温度', start: 28, end: 32, parser: parseTemperature }
    ],
    PAGE2: [
      { key: 'signalValue', label: '信号值', start: 2, end: 4, parser: v => parseInt(v, 16) }
    ]
  },
  RESEND_DELAY: 1200,    // 指令重发间隔（静默）
  AD_DURATION: 400       // 广播时长
}

function parseTemperature(hexStr) {
  if (hexStr.length !== 4) return '无效值'
  const bigEndian = hexStr.slice(2) + hexStr.slice(0, 2)
  let num = parseInt(bigEndian, 16)
  const isNegative = (num & 0x8000) !== 0
  if (isNegative) num = -(num & 0x7FFF)
  return `${(num / 100).toFixed(2)}℃`
}

Page({
  data: {
    address: '',
    kaiduValue: CONSTANTS.DEFAULT_KAIDU,
    upType: CONSTANTS.DEFAULT_UP_TYPE,
    filterName: CONSTANTS.FILTER_NAME,
    bluetoothStatus: '未初始化',
    statusColorClass: 'status-default',
    discoveryStarted: false,
    advertiseStart: false,
    discoveryReady: false,
    advertiseReady: false,
    devices: [],
    servers: [],
    serverId: '',
    deviceStatus: [],
    currentValue: 0,
    system: 'android',
    submitLoading: false,
    cmdLoading: false,
    updateTime: '',

    // 读取状态（严格串行）
    readStatus: {
      isReading: false,
      page1Done: false,
      page2Done: false,
      page1Data: '',
      page2Data: '',
      timer: null
    },
    lastReadPage1Suffix: '',
    readMode: 'single',
  },

  onLoad() {
    this.initSystemInfo()
    this.initStorageData()
    this.initBluetooth()
  },

  onUnload() {
    this.clearTimer()
    this.stopAdvertising()
    this.stopBluetoothDiscovery()
    this.data.servers.forEach(s => s.close())
    wx.closeBluetoothAdapter({ fail: () => {} })
    cacheManager.reset()
  },

  clearTimer() {
    if (this.data.readStatus.timer) {
      clearTimeout(this.data.readStatus.timer)
      this.setData({ 'readStatus.timer': null })
    }
  },

  initSystemInfo() {
    const { system } = wx.getSystemInfoSync()
    this.setData({ system })
  },

  initStorageData() {
    const address = wx.getStorageSync('address') || ''
    const kaiduValue = wx.getStorageSync('kaiduValue') || CONSTANTS.DEFAULT_KAIDU
    this.setData({ address, kaiduValue })
  },

  initBluetooth() {
    this.updateBluetoothStatus('初始化蓝牙...', 'status-loading')
    wx.openBluetoothAdapter({
      success: () => {
        this.updateBluetoothStatus('蓝牙就绪', 'status-success')
        this.initDiscovery()
        this.initAdvertiseServer()
      },
      fail: () => {
        this.updateBluetoothStatus('请开启蓝牙', 'status-error')
      }
    })
  },

  initDiscovery() {
    if (this.data.discoveryStarted) return
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      powerLevel: 'high',
      success: () => {
        this.setData({ discoveryReady: true })
        this.onBLEFound()
      }
    })
    this.setData({ discoveryStarted: true })
  },

  initAdvertiseServer() {
    wx.createBLEPeripheralServer().then(res => {
      this.data.servers.push(res.server)
      this.setData({ advertiseReady: true, serverId: res.server.serverId })
    })
  },

  // ======================= 核心接收逻辑（严格串行） =======================
onBLEFound() {
  wx.onBluetoothDeviceFound(res => {
    res.devices.forEach(device => {
      if (device.localName !== this.data.filterName) return
      if (!device.advertisData) return
      const hex = ab2hex(device.advertisData).substring(4)
      cacheManager.setHex(hex)

      const { isReading, page1Done, page2Done } = this.data.readStatus
      const { readMode } = this.data // 获取读取模式
      if (!isReading) return

      // 单页模式：仅读取第一页(3F)，收到直接完成
      if (readMode === 'single') {
        if (!page1Done && hex.slice(0,2) === '3F') {
          this.clearTimer()
          this.setData({
            'readStatus.page1Done': true,
            'readStatus.page1Data': hex
          })
          this.doParse() // 直接解析
          this.finishRead() // 直接结束
        }
      }

      // 全量模式：原逻辑(3F → 3E)
      if (readMode === 'full') {
        // 第一步：等 3F
        if (!page1Done) {
          if (hex.slice(0,2) === '3F') {
            this.clearTimer()
            this.setData({
              'readStatus.page1Done': true,
              'readStatus.page1Data': hex
            })
            this.updateBluetoothStatus('已收第一页，开始读取第二页', 'status-processing')
            this.startPage2()
          }
        }
        // 第二步：等 3E（必须等3F完成才进入）
        else if (!page2Done) {
          if (hex.slice(0,2) === '3E') {
            this.clearTimer()
            this.setData({
              'readStatus.page2Done': true,
              'readStatus.page2Data': hex
            })
            this.doParse()
            this.finishRead()
          }
        }
      }
    })
  })
},

  // ======================= 启动：只发第一页 =======================
  startRead() {
    this.setData({
      cmdLoading: true,
      readStatus: {
        isReading: true,
        page1Done: false,
        page2Done: false,
        page1Data: '',
        page2Data: '',
        timer: null
      }
    })
    this.updateBluetoothStatus('正在读取第一页...', 'status-processing')
    this.loopPage1()
  },

  // ======================= 循环发第一页（静默） =======================
  loopPage1() {
    if (!this.data.readStatus.isReading || this.data.readStatus.page1Done) return
    this.sendCmd(this.makePage1Cmd(), () => {
      this.setData({
        'readStatus.timer': setTimeout(() => this.loopPage1(), CONSTANTS.RESEND_DELAY)
      })
    })
  },

  // ======================= 启动第二页（3F收到后才执行） =======================
  startPage2() {
    this.updateBluetoothStatus('正在读取第二页...', 'status-processing')
    this.loopPage2()
  },

  // ======================= 循环发第二页（静默） =======================
  loopPage2() {
    if (!this.data.readStatus.isReading || this.data.readStatus.page2Done) return
    this.sendCmd(this.makePage2Cmd(), () => {
      this.setData({
        'readStatus.timer': setTimeout(() => this.loopPage2(), CONSTANTS.RESEND_DELAY)
      })
    })
  },

  //  ======================= 新增：单击读取（仅第一页） =======================
onReadSingleStatus() {
  if (!this.data.address) {
    wx.showToast({ title: '请绑定设备', icon: 'none' })
    return
  }
  if (this.data.cmdLoading) return
  this.startReadSinglePage()
},

// 启动单页读取（仅第一页）
startReadSinglePage() {
  this.setData({
    cmdLoading: true,
    readMode: 'single', // 标记为单页模式
    readStatus: {
      isReading: true,
      page1Done: false,
      page2Done: false,
      page1Data: '',
      page2Data: '',
      timer: null
    }
  })
  this.updateBluetoothStatus('正在读取第一页...', 'status-processing')
  this.loopPage1()
},

// ======================= 启动：只发第一页（长按全量） =======================
startRead() {
  this.setData({
    cmdLoading: true,
    readMode: 'full', // 👇 新增：标记为全量模式
    readStatus: {
      isReading: true,
      page1Done: false,
      page2Done: false,
      page1Data: '',
      page2Data: '',
      timer: null
    }
  })
  this.updateBluetoothStatus('正在读取第一页...', 'status-processing')
  this.loopPage1()
},

  // ======================= 统一发送指令 =======================
  sendCmd(cmd, callback) {
    this.stopAdvertising()
    const isIos = this.data.system.includes('iOS')
    const payload = generateData(cmd, isIos)
    const uuids = getServiceUUIDs(payload, isIos && this.data.system.includes('13.'))

    this.data.servers[0].startAdvertising({
      advertiseRequest: {
        connectable: true,
        deviceName: isIos ? '11' : '',
        serviceUuids: isIos ? uuids : [],
        manufacturerData: isIos ? [] : [{
          manufacturerId: CONSTANTS.MANUFACTURER_ID,
          manufacturerSpecificData: payload
        }]
      },
      powerLevel: 'high'
    }).then(() => {
      this.setData({ advertiseStart: true })
      setTimeout(() => {
        this.stopAdvertising()
        callback()
      }, CONSTANTS.AD_DURATION)
    }).catch(() => {})
  },

  makePage1Cmd() {
    const suffix = this.getRandomReadPage1Suffix()
    const seq = this.getSeq()
    const cmd = CONSTANTS.READ_STATUS_CMD.PAGE1 + suffix + seq
    return this.pad(cmd)
  },

  makePage2Cmd() {
    const seq = this.getSeq()
    const cmd = CONSTANTS.READ_STATUS_CMD.PAGE2 + seq
    return this.pad(cmd)
  },

  getSeq() {
    const map = '0123456789abcdef'
    const c = map[this.data.currentValue % 16]
    this.setData({ currentValue: this.data.currentValue + 1 })
    return c
  },

  pad(cmd) {
    cmd = cmd.replace(/\s/g, '')
    return cmd.length >= 32 ? cmd.slice(0,32) : cmd.padEnd(32, 'f')
  },

  getRandomReadPage1Suffix() {
    const map = '0123456789abcdef'
    let c
    do { c = map[Math.floor(Math.random()*16)] }
    while (c === this.data.lastReadPage1Suffix)
    this.setData({ lastReadPage1Suffix: c })
    return c
  },

  // ======================= 解析 & 结束 =======================
doParse() {
  const p1 = this.data.readStatus.page1Data
  const p2 = this.data.readStatus.page2Data
  const { readMode } = this.data

  if (!p1) return // 必须有第一页数据

  // 解析第一页（通用）
  const status1 = CONSTANTS.STATUS_PARSE.PAGE1.map(i => ({
    label: i.label, value: i.parser(p1.slice(i.start, i.end))
  }))
  
  // 全量模式：追加第二页数据；单页模式：仅第一页
  const status2 = readMode === 'full' && p2 
    ? CONSTANTS.STATUS_PARSE.PAGE2.map(i => ({
        label: i.label, value: i.parser(p2.slice(i.start, i.end))
      })) 
    : []

  this.setData({
    deviceStatus: [...status1, ...status2],
    updateTime: new Date().toLocaleString()
  })
  // 状态提示
  const tip = readMode === 'single' ? '第一页读取完成' : '全量读取完成'
  this.updateBluetoothStatus(tip, 'status-success')
},

  finishRead() {
    this.clearTimer()
    this.stopAdvertising()
    this.setData({
      cmdLoading: false,
      readStatus: { isReading: false, page1Done: false, page2Done: false, page1Data: '', page2Data: '', timer: null }
    })
    cacheManager.reset()
    this.updateBluetoothStatus('读取完成', 'status-success')
  },

  // ======================= 按钮触发：全量读取 =======================
  onReadFullStatus() {
    if (!this.data.address) {
      wx.showToast({ title: '请绑定设备', icon: 'none' })
      return
    }
    if (this.data.cmdLoading) return
    this.startRead()
  },

  // ———————————————————————— 下面是你原有逻辑不动 ————————————————————————
  sendControlCommand(e) {
    const action = e.currentTarget.dataset.action
    // if (action === 'readFullStatus') {
    //   this.onReadFullStatus()
    //   return
    // }

    if (!this.data.address || this.data.cmdLoading) return
    this.setData({ cmdLoading: true })
    const cmd = this.generateControlCmd(e)
    if (!cmd) {
      this.setData({ cmdLoading: false })
      return
    }
    this.sendCmd(cmd, () => {
      this.setData({ cmdLoading: false })
      this.updateBluetoothStatus('指令已发送', 'status-success')
    })
  },

  generateControlCmd(e) {
    const action = e.currentTarget.dataset.action
    const seq = this.getSeq()
    let cmd
    switch (action) {
      case 'openAll': cmd = '221' + seq + '64'; break
      case 'closeAll': cmd = '221' + seq + '00'; break
      case 'qtkd':
        const v = parseInt(this.data.kaiduValue)
        if (isNaN(v) || v<0||v>100) return null
        cmd = '221' + seq + ('0' + v.toString(16)).slice(-2); break
      case 'shengji': cmd = '124' + seq + '0' + this.data.upType; break
      default: return null
    }
    return this.pad(cmd)
  },

  formSubmit(e) {
    const { address } = e.detail.value
    if (!/^\d{6}$/.test(address)) {
      wx.showToast({ title: '6位数字', icon: 'none' })
      return
    }
    wx.setStorageSync('address', address)
    this.setData({ address })
    wx.showToast({ title: '绑定成功', icon: 'success' })
  },

  stopAdvertising() {
    if (this.data.servers.length && this.data.advertiseStart) {
      this.data.servers[0].stopAdvertising()
      this.setData({ advertiseStart: false })
    }
  },

  stopBluetoothDiscovery() {
    if (this.data.discoveryStarted) {
      wx.stopBluetoothDevicesDiscovery()
      this.setData({ discoveryStarted: false })
    }
  },

  inputChanged(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onSliderChange(e) {
    this.setData({ kaiduValue: e.detail.value })
  },

  updateBluetoothStatus(text, cls) {
    this.setData({ bluetoothStatus: text, statusColorClass: cls })
  }
})