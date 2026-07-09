let server = null
let isAdvertising = false

export function getServer() {
  return server
}

export function isReady() {
  return server !== null
}

export function isAdvertiseing() {
  return isAdvertising
}

export function initBeacon() {
  return new Promise((resolve, reject) => {
    if (server) { resolve(server); return }
    wx.openBluetoothAdapter({
      mode: 'peripheral',
      success: () => {
        wx.createBLEPeripheralServer().then(res => {
          server = res.server
          resolve(server)
        }).catch(err => {
          reject(new Error('创建外围服务器失败: ' + err.errMsg))
        })
      },
      fail: (err) => {
        reject(new Error('蓝牙初始化失败: ' + err.errMsg))
      }
    })
  })
}

export function closeBeacon() {
  return new Promise((resolve) => {
    if (server) {
      server.close().then(() => {
        server = null
        isAdvertising = false
        resolve()
      }).catch(() => {
        server = null
        isAdvertising = false
        resolve()
      })
    } else {
      resolve()
    }
  })
}

export function startAdvertising(actPayload) {
  return new Promise((resolve, reject) => {
    if (!server) {
      reject(new Error('外围服务器未初始化'))
      return
    }
    if (isAdvertising) {
      stopAdvertising().then(() => doStart(actPayload, resolve, reject))
    } else {
      doStart(actPayload, resolve, reject)
    }
  })
}

function doStart(actPayload, resolve, reject) {
  const buf = new ArrayBuffer(actPayload.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < actPayload.length; i++) {
    view[i] = actPayload[i] < 0 ? actPayload[i] + 256 : actPayload[i]
  }

  server.startAdvertising({
    advertiseRequest: {
      connectable: true,
      deviceName: '',
      manufacturerData: [{
        manufacturerId: '0x00C7',
        manufacturerSpecificData: buf,
      }],
    },
    powerLevel: 'high',
  }).then(() => {
    isAdvertising = true
    resolve()
  }).catch(err => {
    reject(new Error('广播失败: ' + err.errMsg))
  })
}

export function stopAdvertising() {
  return new Promise((resolve) => {
    if (!server || !isAdvertising) { resolve(); return }
    server.stopAdvertising().then(() => {
      isAdvertising = false
      resolve()
    }).catch(() => {
      isAdvertising = false
      resolve()
    })
  })
}

export function broadcastOnce(actPayload, durationMs = 3000) {
  return new Promise((resolve, reject) => {
    startAdvertising(actPayload).then(() => {
      setTimeout(() => {
        stopAdvertising().then(resolve).catch(resolve)
      }, durationMs)
    }).catch(reject)
  })
}
