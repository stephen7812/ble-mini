export function pressureMPaTo10KPa(mpa) {
  return Math.round(mpa * 100)
}

export function voltageMvToV(mv) {
  return (mv / 1000).toFixed(1)
}

export function formatTimeDiff(timestamp) {
  const diff = Date.now() - (timestamp || 0)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return mins + '分钟前'
  if (mins < 1440) return Math.floor(mins / 60) + '小时前'
  return Math.floor(mins / 1440) + '天前'
}

export function batteryLevel(voltageMv) {
  const v = voltageMv / 1000
  if (v >= 3.6) return 100
  if (v >= 3.4) return 80
  if (v >= 3.2) return 60
  if (v >= 3.0) return 30
  if (v >= 2.8) return 10
  return 0
}
