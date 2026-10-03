/** Only explicitly authored, value-free messages may cross the RPC boundary. */
export class PublicError extends Error {}
export const publicMessage = error => error instanceof PublicError ? error.message : '扫描操作失败，请检查配置或重试'
