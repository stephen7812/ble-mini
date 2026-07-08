import { OLD_VALVE, buildFrame as oldBuild, parseResponse as oldParse, OLD_COMMANDS } from './old-valve'
import { NEW_VALVE, buildFrame as newBuild, parseResponse as newParse, NEW_COMMANDS } from './new-valve'

const UNKNOWN = { type: '未知设备', typeId: '' }
const NAME_PREFIXES = { 'P-': 'new', 'P_': 'new', 'V5-': 'old', 'BA-': 'old', 'BLACKANT': 'old' }

export function detectValveType(device) {
  const name = device.localName || device.name || ''
  for (const [prefix, typeId] of Object.entries(NAME_PREFIXES)) {
    if (name.startsWith(prefix)) return typeId === 'new' ? NEW_VALVE : OLD_VALVE
  }
  return UNKNOWN
}

export function getProtocol(typeId) {
  if (typeId === 'new') {
    return { type: NEW_VALVE, buildFrame: newBuild, parseResponse: newParse, commands: NEW_COMMANDS }
  }
  return { type: OLD_VALVE, buildFrame: oldBuild, parseResponse: oldParse, commands: OLD_COMMANDS }
}

export function detectAndGetProtocol(device) {
  const valveType = detectValveType(device)
  return getProtocol(valveType.typeId)
}
