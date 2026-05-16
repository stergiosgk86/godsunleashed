import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'

export type PassiveItemType = 'bloodTome' | 'eldritchEye' | 'shadowCloak'

const CONFIGS: Record<PassiveItemType, { texture: string; label: string; color: number }> = {
  bloodTome:   { texture: 'item_blood_tome',   label: '+15% MIGHT',     color: 0xff3333 },
  eldritchEye: { texture: 'item_eldritch_eye', label: 'FASTER ATTACKS', color: 0xcc44ff },
  shadowCloak: { texture: 'item_shadow_cloak', label: '+MOVE SPEED',    color: 0x44ddff },
}

const ATTRACT_RADIUS = 110
const ATTRACT_SPEED = 260
const COLLECT_RADIUS = 24

export class PassiveItem {
  x: number
  y: number
  active = true
  readonly type: PassiveItemType
  private graphic: Phaser.GameObjects.Image
  private bobTimer: number

  constructor(scene: Phaser.Scene, x: number, y: number, type: PassiveItemType) {
    this.x = x
    this.y = y
    this.type = type
    this.bobTimer = Math.random() * Math.PI * 2
    this.graphic = scene.add.image(x, y, CONFIGS[type].texture)
      .setDepth(1)
      .setScale(1.4)
  }

  update(playerX: number, playerY: number, delta: number): boolean {
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < COLLECT_RADIUS) {
      this.applyEffect()
      this.destroy()
      return true
    }

    const dt = delta / 1000
    if (dist < ATTRACT_RADIUS) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    this.bobTimer += delta * 0.0022
    this.graphic.setPosition(this.x, this.y + Math.sin(this.bobTimer) * 3.5)
    this.graphic.rotation += 0.012 * (delta / 16)

    return false
  }

  private applyEffect() {
    const s = useGameStore.getState()
    switch (this.type) {
      case 'bloodTome':
        useGameStore.setState({ might: s.might + 0.15 })
        break
      case 'eldritchEye':
        useGameStore.setState({ attackInterval: Math.max(100, Math.floor(s.attackInterval * 0.82)) })
        break
      case 'shadowCloak':
        useGameStore.setState({ moveSpeed: s.moveSpeed + 30 })
        break
    }
  }

  getLabel(): string { return CONFIGS[this.type].label }
  getColor(): number { return CONFIGS[this.type].color }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}

export const ALL_ITEM_TYPES: PassiveItemType[] = ['bloodTome', 'eldritchEye', 'shadowCloak']
