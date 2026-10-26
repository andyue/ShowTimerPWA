import { createContext, useContext } from 'react'
import type { BroadcastRoom } from '../services/Broadcast'

export interface Connections {
  room: BroadcastRoom | null
  broadcastStatus: string
  startBroadcast: (url: string, key: string, viewerBaseUrl?: string) => void
  stopBroadcast: () => void
  oscStatus: string
  connectOsc: (url: string, token: string) => void
  disconnectOsc: () => void
}
export const ConnectionsContext = createContext<Connections | null>(null)
export function useConnections() {
  const value = useContext(ConnectionsContext)
  if (!value) throw new Error('ConnectionsProvider missing')
  return value
}
