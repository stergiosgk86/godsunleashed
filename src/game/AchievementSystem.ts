import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { runData } from './runData'
import { activeNetClient } from '../net/netState'
import { ACHIEVEMENT_MAP } from './achievements'

export class AchievementSystem {
  private checked = new Set<string>()

  // Call once at run start with already-unlocked IDs so we don't re-toast old achievements
  preload(unlockedIds: string[]) {
    for (const id of unlockedIds) this.checked.add(id)
  }

  private async unlock(id: string) {
    if (this.checked.has(id)) return
    this.checked.add(id)

    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await fetch('/api/achievements/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ achievementId: id }),
      })
      const data = await res.json() as { isNew?: boolean }
      if (data.isNew) {
        const achievement = ACHIEVEMENT_MAP[id]
        if (achievement) useGameStore.setState({ recentAchievement: { id, name: achievement.name } })
      }
    } catch { /* network error — ignore */ }
  }

  update() {
    const s = useGameStore.getState()
    const elapsed = runData.elapsed
    const isMultiplayer = !!activeNetClient

    if (elapsed >= 5 * 60 * 1000)  this.unlock('survivor_5')
    if (elapsed >= 20 * 60 * 1000) this.unlock('veteran')
    if (s.bossKills >= 1)          this.unlock('boss_slayer')
    if (s.kills >= 100)            this.unlock('hunter')
    if (s.kills >= 500)            this.unlock('slaughterer')
    if (s.damageDealt >= 10_000)   this.unlock('destroyer')
    if (s.sessionCoins >= 100)     this.unlock('wealthy')
    if (s.level >= 10)             this.unlock('ascendant')
    if (s.level >= 20)             this.unlock('transcendent')

    const weaponCount = 1 +
      (s.aura > 0 ? 1 : 0) +
      (s.orbital > 0 ? 1 : 0) +
      (s.boomerang ? 1 : 0) +
      (s.flameTrail ? 1 : 0) +
      (s.bloodNova ? 1 : 0)
    if (weaponCount >= 5) this.unlock('arsenal')

    if (s.isWon) {
      this.unlock('god_slayer')
      if (!s.tookDamageThisRun)              this.unlock('untouchable')
      if (s.hp <= Math.ceil(s.maxHp * 0.1)) this.unlock('glass_cannon')
      if (isMultiplayer)                     this.unlock('champions')
    }
    if (isMultiplayer && (s.isWon || s.isDead)) this.unlock('team_player')
  }
}
