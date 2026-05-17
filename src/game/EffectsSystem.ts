import Phaser from 'phaser'

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
  private life = 200
  private maxLife = 200

  constructor(scene: Phaser.Scene, x: number, y: number, frame: string | number) {
    this.graphic = scene.add
      .sprite(x, y, 'player', frame)
      .setDepth(3)
      .setScale(1.5)
      .setAlpha(0.5)
      .setTint(0x4488ff)
  }

  update(delta: number) {
    this.life -= delta
    if (this.life <= 0) { this.destroy(); return }
    this.graphic.setAlpha((this.life / this.maxLife) * 0.45)
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

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, color: string) {
    this.text = scene.add
      .text(x, y - 24, label, {
        fontSize: '14px', color,
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
  private labels: FloatLabel[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  showDamageNumber(x: number, y: number, amount: number) {
    this.numbers.push(new DamageNumber(this.scene, x, y, amount))
  }

  showDeathBurst(x: number, y: number) {
    const colors = [0xff4444, 0xff8844, 0xffaa44, 0xff2222]
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(this.scene, x, y, colors[i % colors.length]))
    }
  }

  showXPCollect(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      this.particles.push(new Particle(this.scene, x, y, 0x00ff88))
    }
  }

  showDashGhost(x: number, y: number, frame: string | number) {
    this.ghosts.push(new DashGhost(this.scene, x, y, frame))
  }

  showItemCollect(x: number, y: number, label: string, color: number) {
    const hex = `#${color.toString(16).padStart(6, '0')}`
    this.labels.push(new FloatLabel(this.scene, x, y, label, hex))
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
    for (const l of this.labels) l.update(delta)
    this.numbers = this.numbers.filter(n => n.active)
    this.particles = this.particles.filter(p => p.active)
    this.ghosts = this.ghosts.filter(g => g.active)
    this.labels = this.labels.filter(l => l.active)
  }
}
