const SERVICE_UUID = ''
const WRITE_CHAR_UUID = ''
const NOTIFY_CHAR_UUID = ''

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
        const svc = res.services.find(s => s.uuid.includes(SERVICE_UUID)) || res.services[0]
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
        const writeChar = res.characteristics.find(c => c.uuid.includes(WRITE_CHAR_UUID) || (c.properties & 0x04))
        const notifyChar = res.characteristics.find(c => c.uuid.includes(NOTIFY_CHAR_UUID) || (c.properties & 0x10))
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

export function disconnect() {
  if (deviceId) {
    wx.closeBLEConnection({ deviceId })
    deviceId = ''; serviceId = ''; writeCharId = ''; notifyCharId = ''
  }
}
