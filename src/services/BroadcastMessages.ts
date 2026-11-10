// Keep English UI compatible with servers running the earlier message strings.
const legacyMessages: Record<string, string> = {
  "\u5efa\u7acb\u623f\u9593\u7684\u670d\u52d9\u91d1\u9470\u4e0d\u6b63\u78ba": "Invalid room creation key",
  "\u670d\u52d9\u623f\u9593\u5df2\u6eff\uff0c\u8acb\u7a0d\u5f8c\u91cd\u8a66": "Room limit reached. Try again later.",
  "\u5ee3\u64ad\u5df2\u7d50\u675f\u6216\u623f\u9593\u4e0d\u5b58\u5728\uff0c\u8acb\u5411\u4e3b\u63a7\u53d6\u5f97\u65b0\u9023\u7d50": "Broadcast ended or room not found. Get a new link from the controller.",
  "\u5df2\u6709\u53e6\u4e00\u500b\u4e3b\u63a7\u9023\u7dda\uff0c\u8acb\u5148\u95dc\u9589\u539f\u4e3b\u63a7": "Another controller is connected. Close it first.",
  "\u89c0\u770b\u9023\u7d50\u6216\u4e3b\u63a7\u6191\u8b49\u7121\u6548": "Invalid viewer link or controller credentials",
  "\u8acb\u5148\u52a0\u5165\u623f\u9593": "Join a room first",
  "\u89c0\u770b\u7aef\u4e0d\u80fd\u63a7\u5236\u5ee3\u64ad": "Viewers cannot control broadcasts",
  "\u540c\u6b65\u8cc7\u6599\u683c\u5f0f\u4e0d\u6b63\u78ba": "Invalid broadcast data",
 }

export function broadcastMessage(message: unknown, fallback = 'Broadcast ended'): string {
  return typeof message === 'string' && message ? legacyMessages[message] ?? message : fallback
}
