import musicUrl from '../assets/Graveyard Dash.mp3'

const STORAGE_KEY     = 'gods_muted'
const MUSIC_VOL_KEY   = 'gods_music_vol'
const MUSIC_VOLUME    = 0.35

class SoundSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private _muted: boolean
  private music: HTMLAudioElement | null = null
  private _musicVolume: number
  private xpLastPlayed = 0
  private coinLastPlayed = 0
  private hitLastPlayed = 0

  constructor() {
    this._muted = localStorage.getItem(STORAGE_KEY) === 'true'
    this._musicVolume = parseFloat(localStorage.getItem(MUSIC_VOL_KEY) ?? String(MUSIC_VOLUME))
    // Resume the context on every user gesture — browsers may suspend it on
    // page blur or if created before sufficient user engagement.
    const resumeCtx = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
    }
    window.addEventListener('keydown', resumeCtx)
    window.addEventListener('mousedown', resumeCtx)
  }

  get muted() { return this._muted }
  get musicVolume() { return this._musicVolume }

  toggleMute() {
    this._muted = !this._muted
    localStorage.setItem(STORAGE_KEY, String(this._muted))
    if (this.master) this.master.gain.value = this._muted ? 0 : 0.3
    if (this.music) this.music.volume = this._muted ? 0 : this._musicVolume
  }

  setMusicVolume(v: number) {
    this._musicVolume = Math.max(0, Math.min(1, v))
    localStorage.setItem(MUSIC_VOL_KEY, String(this._musicVolume))
    if (this.music && !this._muted) this.music.volume = this._musicVolume
  }

  startMusic() {
    if (this.music) this.stopMusic()
    this.music = new Audio(musicUrl)
    this.music.loop = true
    this.music.volume = this._muted ? 0 : this._musicVolume
    this.music.play().catch(() => {})
  }

  stopMusic() {
    if (!this.music) return
    this.music.pause()
    this.music.currentTime = 0
    this.music = null
  }

  pauseMusic() {
    this.music?.pause()
  }

  resumeMusic() {
    if (this.music && !this._muted) this.music.play().catch(() => {})
  }

  private getCtx(): { ctx: AudioContext; out: AudioNode } | null {
    if (this._muted) return null
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.3
        this.master.connect(this.ctx.destination)
      } catch {
        return null
      }
    }
    // ctx.currentTime is frozen when suspended so scheduled audio plays
    // immediately once resume() fires — no need to gate on 'running'.
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return { ctx: this.ctx, out: this.master! }
  }

  shoot() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.09)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(gain); gain.connect(out)
    osc.start(t); osc.stop(t + 0.1)
  }

  enemyHit() {
    const now = Date.now()
    if (now - this.hitLastPlayed < 55) return
    this.hitLastPlayed = now
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(260, t)
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.065)
    gain.gain.setValueAtTime(0.1, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(gain); gain.connect(out)
    osc.start(t); osc.stop(t + 0.07)
  }

  enemyDie() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(340, t)
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.26)
    oscGain.gain.setValueAtTime(0.16, t)
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.connect(oscGain); oscGain.connect(out)
    osc.start(t); osc.stop(t + 0.28)

    const bufLen = Math.floor(ctx.sampleRate * 0.14)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'; flt.frequency.value = 900
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.13, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    noise.connect(flt); flt.connect(ng); ng.connect(out)
    noise.start(t)
  }

  bossDie() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime

    const bufLen = Math.floor(ctx.sampleRate * 1.1)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.sqrt(1 - i / bufLen)
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.setValueAtTime(2200, t)
    flt.frequency.exponentialRampToValueAtTime(70, t + 1.1)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.55, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.1)
    noise.connect(flt); flt.connect(ng); ng.connect(out)
    noise.start(t)

    const victoryNotes = [392, 523, 659, 784, 1047]
    victoryNotes.forEach((freq, i) => {
      const nt = t + 0.35 + i * 0.14
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0.22, nt)
      g.gain.exponentialRampToValueAtTime(0.001, nt + 0.28)
      osc.connect(g); g.connect(out)
      osc.start(nt); osc.stop(nt + 0.28)
    })
  }

  playerHit() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.32)
    gain.gain.setValueAtTime(0.38, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36)
    osc.connect(gain); gain.connect(out)
    osc.start(t); osc.stop(t + 0.36)
  }

  levelUp() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.12
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.26, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(gain); gain.connect(out)
      osc.start(t); osc.stop(t + 0.22)
    })
  }

  xpCollect() {
    const now = Date.now()
    if (now - this.xpLastPlayed < 80) return
    this.xpLastPlayed = now
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 1300 + Math.random() * 250
    gain.gain.setValueAtTime(0.07, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(gain); gain.connect(out)
    osc.start(t); osc.stop(t + 0.06)
  }

  coinCollect() {
    const now = Date.now()
    if (now - this.coinLastPlayed < 50) return
    this.coinLastPlayed = now
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1700, t)
    osc.frequency.exponentialRampToValueAtTime(2500, t + 0.07)
    gain.gain.setValueAtTime(0.13, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(gain); gain.connect(out)
    osc.start(t); osc.stop(t + 0.1)
  }

  dash() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const bufLen = Math.floor(ctx.sampleRate * 0.2)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'bandpass'
    flt.frequency.setValueAtTime(350, t)
    flt.frequency.exponentialRampToValueAtTime(3500, t + 0.16)
    flt.Q.value = 2.5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.32, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    noise.connect(flt); flt.connect(gain); gain.connect(out)
    noise.start(t)
  }

  bossWarning() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.42
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      osc1.type = 'sawtooth'; osc1.frequency.value = 75
      osc2.type = 'sine';     osc2.frequency.value = 115
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      osc1.connect(gain); osc2.connect(gain); gain.connect(out)
      osc1.start(t); osc1.stop(t + 0.38)
      osc2.start(t); osc2.stop(t + 0.38)
    }
  }

  async testBeep() {
    console.log('[Sound] muted:', this._muted)
    console.log('[Sound] ctx:', this.ctx, 'state:', this.ctx?.state ?? 'no ctx')
    const r = this.getCtx()
    console.log('[Sound] getCtx returned:', r ? 'ok' : 'null')
    if (!r) return
    const { ctx } = r
    if (ctx.state === 'suspended') {
      console.log('[Sound] suspended — awaiting resume()')
      await ctx.resume()
      console.log('[Sound] resumed, state now:', ctx.state)
    }
    const t = ctx.currentTime + 0.05

    // Test A: via master gain chain
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(gain); gain.connect(this.master!)
    osc.start(t); osc.stop(t + 0.6)
    console.log('[Sound] Test A (via master gain) scheduled at t =', t, '— should hear 440 Hz')

    // Test B: direct to destination, bypassing master gain
    const osc2 = ctx.createOscillator()
    osc2.frequency.value = 880
    osc2.connect(ctx.destination)
    osc2.start(t + 0.7); osc2.stop(t + 1.3)
    console.log('[Sound] Test B (direct to destination) at t =', t + 0.7, '— should hear 880 Hz')
  }
}

export const soundSystem = new SoundSystem() ;
(window as unknown as Record<string, unknown>).soundSystem = soundSystem
