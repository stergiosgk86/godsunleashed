import Phaser from 'phaser'

function compact<T extends { active: boolean }>(arr: T[]): void {
  let i = 0
  while (i < arr.length) {
    if (arr[i].active) { i++; continue }
    arr[i] = arr[arr.length - 1]
    arr.pop()
  }
}

const MAX_NUMBERS  = 24
const MAX_PARTICLES = 180

class DamageNumber {
  text: Phaser.GameObjects.Text
  active = true
  private vy = -70
  private life = 800
  private maxLife = 800

  constructor(scene: Phaser.Scene, x: number, y: number, amount: number) {
    const color = amount >= 3 ? '#ff8844' : amount >= 2 ? '#ffdd44' : '#ffffff'
    this.text = scene.add
      .text(x, y - 16, `${amount}`, {
        fontSize: '20px',
        color,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10)
  }

  update(delta: number) {
    this.life -= delta
    if (this.life <= 0) { this.destroy(); return }
    const dt = delta / 1000
    this.text.y += this.vy * dt
    this.vy += 40 * dt  // decelerate upward float
    this.text.setAlpha(this.life / this.maxLife)
  }

  destroy() {
    this.text.destroy()
    this.active = false
  }
}

class Particle {
  graphic: Phaser.GameObjects.Rectangle
  active = true
  private vx: number
  private vy: number
  private life: number
  private maxLife: number

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    const angle = Math.random() * Math.PI * 2
    const speed = 60 + Math.random() * 120
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed - 40
    this.maxLife = 350 + Math.random() * 200
    this.life = this.maxLife

    const size = 3 + Math.random() * 5
    this.graphic = scene.add.rectangle(x, y, size, size, color).setDepth(5)
  }

  update(delta: number) {
    this.life -= delta
    if (this.life <= 0) { this.destroy(); return }
    const dt = delta / 1000
    this.vy += 150 * dt  // gravity
    this.graphic.x += this.vx * dt
    this.graphic.y += this.vy * dt
    const pct = this.life / this.maxLife
    this.graphic.setAlpha(pct).setScale(pct)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}

class DashGhost {
  graphic: Phaser.GameObjects.Sprite
  active = true
  private life = 280
  private maxLife = 280

  constructor(scene: Phaser.Scene, x: number, y: number, frame: string | number) {
    this.graphic = scene.add
      .sprite(x, y, 'player', frame)
      .setDepth(3.9)
      .setScale(1.5)
      .setAlpha(0.85)
      .setTint(0x88ccff)
  }

  update(delta: number) {
    this.life -= delta
    if (this.life <= 0) { this.destroy(); return }
    this.graphic.setAlpha((this.life / this.maxLife) * 0.85)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}

class MoveGhost {
  graphic: Phaser.GameObjects.Sprite
  active = true
  private life = 250
  private maxLife = 250

  constructor(scene: Phaser.Scene, x: number, y: number, spriteKey: string, frame: string | number, scale: number) {
    this.graphic = scene.add
      .sprite(x, y, spriteKey, frame)
      .setDepth(3.9)
      .setScale(scale)
      .setAlpha(0.7)
  }

  update(delta: number) {
    this.life -= delta
    if (this.life <= 0) { this.destroy(); return }
    this.graphic.setAlpha((this.life / this.maxLife) * 0.7)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}

class FloatLabel {
  private text: Phaser.GameObjects.Text
  active = true
  private life = 1600
  private maxLife = 1600
  private vy = -50

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, color: string, fontSize = 14) {
    this.text = scene.add
      .text(x, y - 24, label, {
        fontSize: `${fontSize}px`, color,
        fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(12)
  }

  update(delta: number) {
    this.life -= delta
    if (this.life <= 0) { this.destroy(); return }
    const dt = delta / 1000
    this.text.y += this.vy * dt
    this.vy *= 0.96
    this.text.setAlpha(Math.min(1, this.life / (this.maxLife * 0.25)))
  }

  destroy() {
    this.text.destroy()
    this.active = false
  }
}

export class EffectsSystem {
  private scene: Phaser.Scene
  private numbers: DamageNumber[] = []
  private particles: Particle[] = []
  private ghosts: DashGhost[] = []
  private moveGhosts: MoveGhost[] = []
  private labels: FloatLabel[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  showDamageNumber(x: number, y: number, amount: number) {
    if (this.numbers.length >= MAX_NUMBERS) return
    this.numbers.push(new DamageNumber(this.scene, x, y, amount))
  }

  showDeathBurst(x: number, y: number) {
    if (this.particles.length >= MAX_PARTICLES) return
    const colors = [0xff4444, 0xff8844, 0xffaa44, 0xff2222]
    const count = Math.min(10, MAX_PARTICLES - this.particles.length)
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(this.scene, x, y, colors[i % colors.length]))
    }
  }

  showAuraPop(x: number, y: number) {
    if (this.particles.length >= MAX_PARTICLES) return
    const colors = [0xcc44ff, 0x9922ee, 0xff88ff, 0x7700cc]
    const count = Math.min(5, MAX_PARTICLES - this.particles.length)
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(this.scene, x, y, colors[i % colors.length]))
    }
  }

  showXPCollect(x: number, y: number) {
    if (this.particles.length >= MAX_PARTICLES) return
    const count = Math.min(5, MAX_PARTICLES - this.particles.length)
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(this.scene, x, y, 0x00ff88))
    }
  }

  showDashGhost(x: number, y: number, frame: string | number) {
    this.ghosts.push(new DashGhost(this.scene, x, y, frame))
  }

  showMoveGhost(x: number, y: number, spriteKey: string, scale: number, frame: string | number) {
    this.moveGhosts.push(new MoveGhost(this.scene, x, y, spriteKey, frame, scale))
  }

  showItemCollect(x: number, y: number, label: string, color: number, fontSize = 14) {
    const hex = `#${color.toString(16).padStart(6, '0')}`
    this.labels.push(new FloatLabel(this.scene, x, y, label, hex, fontSize))
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(this.scene, x, y, color))
    }
  }

  shakeCamera() {
    this.scene.cameras?.main?.shake(180, 0.012)
  }

  update(delta: number) {
    for (const n of this.numbers) n.update(delta)
    for (const p of this.particles) p.update(delta)
    for (const g of this.ghosts) g.update(delta)
    for (const m of this.moveGhosts) m.update(delta)
    for (const l of this.labels) l.update(delta)
    compact(this.numbers)
    compact(this.particles)
    compact(this.ghosts)
    compact(this.moveGhosts)
    compact(this.labels)
  }
}
