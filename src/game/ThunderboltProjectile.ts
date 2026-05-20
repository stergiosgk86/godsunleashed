import Phaser from 'phaser'
import { Projectile } from './Projectile'

export class ThunderboltProjectile extends Projectile {
  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    super(scene, x, y, targetX, targetY, 'zeus_bolt', 620, 1.2)
    this.hitRadius = 26
  }
}
