const BLACK_ANT_FILTER = { namePrefix: ['V5-', 'BA-', 'BLACKANT'] }
let scanTimer = null

export function startScan({ onFound, onError, duration = 10000 }) {
  wx.openBluetoothAdapter({
    success() {
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false, interval: 0,
        success() {
          wx.onBluetoothDeviceFound((res) => {
            res.devices.forEach((device) => {
              if (isBlackAntDevice(device)) onFound(device)
            })
          })
        },
        fail(err) { onError(new Error('启动扫描失败: ' + err.errMsg)) },
      })
    },
    fail(err) {
      if (err.errCode === 10001) {
        wx.showModal({ title: '提示', content: '请打开手机蓝牙', showCancel: false })
      }
      onError(new Error('蓝牙未开启: ' + err.errMsg))
    },
  })
  scanTimer = setTimeout(stopScan, duration)
}

export function stopScan() {
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  wx.stopBluetoothDevicesDiscovery({})
  wx.offBluetoothDeviceFound()
}

export function closeBluetooth() {
  stopScan()
  wx.closeBluetoothAdapter({})
}

function isBlackAntDevice(device) {
  const name = device.localName || device.name || ''
  if (BLACK_ANT_FILTER.namePrefix.some(p => name.startsWith(p))) return true
  if (device.advertisData) {
    const buf = new Uint8Array(device.advertisData)
    if (buf.length >= 2 && ((buf[1] << 8) | buf[0]) === 0x06B0) return true
  }
  return false
}
