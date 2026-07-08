let scanTimer = null

export function startScan({ onFound, onError, duration = 10000 }) {
  wx.getBluetoothAdapterState({
    success(res) {
      if (!res.available) {
        onError(new Error('蓝牙不可用'))
        return
      }
      startDiscovery(onFound, onError)
    },
    fail() {
      wx.openBluetoothAdapter({
        success() { startDiscovery(onFound, onError) },
        fail(err) {
          if (err.errCode === 10001) {
            wx.showModal({ title: '提示', content: '请打开手机蓝牙', showCancel: false })
          }
          onError(new Error('蓝牙初始化失败: ' + err.errMsg))
        },
      })
    },
  })
  scanTimer = setTimeout(stopScan, duration)
}

function startDiscovery(onFound, onError) {
  wx.onBluetoothDeviceFound((res) => {
    res.devices.forEach((device) => onFound(device))
  })
  wx.startBluetoothDevicesDiscovery({
    allowDuplicatesKey: false, interval: 0,
    fail(err) {
      wx.offBluetoothDeviceFound()
      onError(new Error('启动扫描失败: ' + err.errMsg))
    },
  })
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
