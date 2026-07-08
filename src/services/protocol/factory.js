import { OLD_VALVE, buildFrame as oldBuild, parseResponse as oldParse, OLD_COMMANDS } from './old-valve'
import { NEW_VALVE, buildFrame as newBuild, parseResponse as newParse, NEW_COMMANDS } from './new-valve'

export function detectValveType(device) {
  const name = device.localName || device.name || ''
  if (name.includes('P-') || name.includes('P_')) return NEW_VALVE
  return OLD_VALVE
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
