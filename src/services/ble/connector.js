let deviceId = ''
let serviceId = ''
let writeCharId = ''
let notifyCharId = ''

export function connect(devId) {
  return new Promise((resolve, reject) => {
    deviceId = devId
    wx.createBLEConnection({
      deviceId,
      success() { discoverServices().then(resolve).catch(reject) },
      fail(err) { reject(new Error('连接失败: ' + err.errMsg)) },
    })
  })
}

function discoverServices() {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceServices({
      deviceId,
      success(res) {
        const svc = res.services.find(s => s.uuid.includes('ffe0') || s.uuid.includes('fff0')) || res.services[0]
        serviceId = svc.uuid
        discoverCharacteristics().then(resolve).catch(reject)
      },
      fail(err) { reject(new Error('获取服务失败: ' + err.errMsg)) },
    })
  })
}

function discoverCharacteristics() {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceCharacteristics({
      deviceId, serviceId,
      success(res) {
        const writeChar = res.characteristics.find(c => (c.properties & 0x08) || (c.properties & 0x04))
        const notifyChar = res.characteristics.find(c => (c.properties & 0x10) || (c.properties & 0x20))
        if (!writeChar) { reject(new Error('未找到可写的特征值')); return }
        writeCharId = writeChar.uuid
        notifyCharId = notifyChar?.uuid || ''
        if (notifyCharId) {
          wx.notifyBLECharacteristicValueChange({ deviceId, serviceId, characteristicId: notifyCharId, state: true })
        }
        resolve()
      },
      fail(err) { reject(new Error('获取特征值失败: ' + err.errMsg)) },
    })
  })
}

export function write(data) {
  return new Promise((resolve, reject) => {
    wx.writeBLECharacteristicValue({
      deviceId, serviceId, characteristicId: writeCharId,
      value: data.buffer || data,
      success: resolve,
      fail(err) { reject(new Error('写入失败: ' + err.errMsg)) },
    })
  })
}

export function onNotify(callback) {
  wx.onBLECharacteristicValueChange((res) => {
    callback(new Uint8Array(res.value))
  })
}

const DIS_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb'
const DIS_CHARS = [
  { uuid: '00002a29-0000-1000-8000-00805f9b34fb', name: '厂商' },
  { uuid: '00002a24-0000-1000-8000-00805f9b34fb', name: '型号' },
  { uuid: '00002a26-0000-1000-8000-00805f9b34fb', name: '固件版本' },
  { uuid: '00002a27-0000-1000-8000-00805f9b34fb', name: '硬件版本' },
]

export function readDeviceInfo() {
  return new Promise((resolve) => {
    const result = { label: '设备信息' }
    let pending = DIS_CHARS.length
    DIS_CHARS.forEach(({ uuid, name }) => {
      wx.readBLECharacteristicValue({
        deviceId, characteristicId: uuid, serviceId: DIS_SERVICE,
        success(res) {
          result[name] = new Uint8Array(res.value).reduce((s, b) => s + String.fromCharCode(b), '')
        },
        fail() {},
        complete() { if (--pending <= 0) resolve(result) },
      })
    })
    setTimeout(() => resolve(result), 1500)
  })
}

export function disconnect() {
  if (deviceId) {
    wx.closeBLEConnection({ deviceId })
    deviceId = ''; serviceId = ''; writeCharId = ''; notifyCharId = ''
  }
}
