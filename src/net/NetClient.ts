import type { C2SMessage, S2CMessage } from './protocol'

type MsgHandler<T extends S2CMessage> = (msg: T) => void
type HandlerMap = {
  [K in S2CMessage['type']]?: MsgHandler<Extract<S2CMessage, { type: K }>>
}

export class NetClient {
  private ws: WebSocket
  private handlers: HandlerMap = {}
  playerId = ''

  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.ws.onmessage = (e: MessageEvent<string>) => {
      const msg = JSON.parse(e.data) as S2CMessage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = this.handlers[msg.type] as MsgHandler<any> | undefined
      h?.(msg)
    }
    this.ws.onerror = () => {
      console.error(`[NetClient] WebSocket error connecting to ${url}`)
    }
  }

  on<K extends S2CMessage['type']>(
    type: K,
    handler: MsgHandler<Extract<S2CMessage, { type: K }>>,
  ): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.handlers[type] = handler as MsgHandler<any>
    return this
  }

  send(msg: C2SMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  onOpen(cb: () => void): this {
    if (this.ws.readyState === WebSocket.OPEN) cb()
    else this.ws.addEventListener('open', cb, { once: true })
    return this
  }

  onClose(cb: (code: number, reason: string) => void): this {
    this.ws.addEventListener('close', (e: CloseEvent) => cb(e.code, e.reason))
    return this
  }

  close() { this.ws.close() }
}
