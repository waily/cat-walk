export type CatFrame = { x: number; ears: string; eyes: string; z: string }

declare module 'claude-code' {
  interface PluginState {
    'cat-walk': {
      enabled: boolean
      visible: boolean
      frame: CatFrame
    }
  }
}
