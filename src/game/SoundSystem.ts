import graveyardDashUrl      from '../assets/Music/Graveyard Dash.mp3'
import eternalGodClashUrl    from '../assets/Music/Eternal God Clash.mp3'
import eternalGodClash2Url   from '../assets/Music/Eternal God Clash 2.mp3'
import olympusResetUrl       from '../assets/Music/Olympus Reset.mp3'
import olympusRestartUrl     from '../assets/Music/Olympus Restart.mp3'
import bloodBetweenStarsUrl  from '../assets/Music/Blood Between Stars.mp3'
import ironGodsAwakeUrl      from '../assets/Music/Iron Gods Awake.mp3'

export const MUSIC_TRACKS: ReadonlyArray<{ id: string; label: string; url: string }> = [
  { id: 'graveyard-dash',       label: 'Graveyard Dash',       url: graveyardDashUrl },
  { id: 'eternal-god-clash',    label: 'Eternal God Clash',    url: eternalGodClashUrl },
  { id: 'eternal-god-clash-2',  label: 'Eternal God Clash 2',  url: eternalGodClash2Url },
  { id: 'olympus-reset',        label: 'Olympus Reset',        url: olympusResetUrl },
  { id: 'olympus-restart',      label: 'Olympus Restart',      url: olympusRestartUrl },
  { id: 'blood-between-stars',  label: 'Blood Between Stars',  url: bloodBetweenStarsUrl },
  { id: 'iron-gods-awake',      label: 'Iron Gods Awake',      url: ironGodsAwakeUrl },
]

const STORAGE_KEY      = 'gods_muted'
const MUSIC_VOL_KEY    = 'gods_music_vol'
const MUSIC_POS_KEY    = 'gods_music_pos'
const GAME_TRACK_KEY   = 'gods_game_track'
const MUSIC_VOLUME     = 0.35
const DEFAULT_GAME_TRACK = 'graveyard-dash'
const MENU_TRACK_URL   = eternalGodClashUrl

class SoundSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private _muted: boolean
  private music: HTMLAudioElement | null = null
  private _musicVolume: number
  private _gameTrackId: string
  private xpLastPlayed = 0
  private coinLastPlayed = 0
  private hitLastPlayed = 0
  private healLastPlayed = 0
  private readonly resumeCtx: () => void

  constructor() {
    this._muted = localStorage.getItem(STORAGE_KEY) === 'true'
    this._musicVolume = parseFloat(localStorage.getItem(MUSIC_VOL_KEY) ?? String(MUSIC_VOLUME))
    this._gameTrackId = localStorage.getItem(GAME_TRACK_KEY) ?? DEFAULT_GAME_TRACK
    this.resumeCtx = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
    }
    window.addEventListener('keydown', this.resumeCtx)
    window.addEventListener('mousedown', this.resumeCtx)
    window.addEventListener('beforeunload', () => {
      if (this.music) sessionStorage.setItem(MUSIC_POS_KEY, String(this.music.currentTime))
    })
  }

  get muted() { return this._muted }
  get musicVolume() { return this._musicVolume }
  get gameTrackId() { return this._gameTrackId }

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

  setGameTrackId(id: string) {
    this._gameTrackId = id
    localStorage.setItem(GAME_TRACK_KEY, id)
  }

  private playUrl(url: string, restorePos = false) {
    if (this.music) this.stopMusic()
    this.music = new Audio(url)
    this.music.loop = true
    this.music.volume = this._muted ? 0 : this._musicVolume
    if (restorePos) {
      const saved = sessionStorage.getItem(MUSIC_POS_KEY)
      if (saved) {
        this.music.currentTime = parseFloat(saved)
        sessionStorage.removeItem(MUSIC_POS_KEY)
      }
    }
    this.music.play().catch(() => {
      const retry = () => {
        this.music?.play().catch(() => {})
        window.removeEventListener('keydown', retry)
        window.removeEventListener('mousedown', retry)
        window.removeEventListener('touchstart', retry)
      }
      window.addEventListener('keydown', retry, { once: true })
      window.addEventListener('mousedown', retry, { once: true })
      window.addEventListener('touchstart', retry, { once: true })
    })
  }

  startMenuMusic() {
    this.playUrl(MENU_TRACK_URL)
  }

  startMusic() {
    const track = MUSIC_TRACKS.find(t => t.id === this._gameTrackId) ?? MUSIC_TRACKS[0]
    this.playUrl(track.url, true)
  }

  stopMusic() {
    if (!this.music) return
    this.music.pause()
    this.music.currentTime = 0
    sessionStorage.removeItem(MUSIC_POS_KEY)
    this.music = null
  }

  pauseMusic() {
    this.music?.pause()
  }

  resumeMusic() {
    if (this.music && !this._muted) this.music.play().catch(() => {})
  }

  duckMusic(ratio = 0.2) {
    if (!this.music || this._muted) return
    this.fadeMusic(this._musicVolume * ratio, 250)
  }

  unduckMusic() {
    if (!this.music || this._muted) return
    this.fadeMusic(this._musicVolume, 350)
  }

  private fadeMusic(targetVol: number, durationMs: number) {
    if (!this.music) return
    const start = this.music.volume
    const startTime = Date.now()
    const tick = () => {
      if (!this.music) return
      const t = Math.min((Date.now() - startTime) / durationMs, 1)
      this.music.volume = start + (targetVol - start) * t
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
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

  shootWand() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1100, t)
    osc.frequency.exponentialRampToValueAtTime(2600, t + 0.07)
    gain.gain.setValueAtTime(0.14, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11)
    osc.connect(gain); gain.connect(out)
    osc.start(t); osc.stop(t + 0.11)
    // Shimmer layer
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1900, t + 0.02)
    osc2.frequency.exponentialRampToValueAtTime(3400, t + 0.1)
    gain2.gain.setValueAtTime(0, t)
    gain2.gain.linearRampToValueAtTime(0.07, t + 0.03)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc2.connect(gain2); gain2.connect(out)
    osc2.start(t + 0.02); osc2.stop(t + 0.12)
  }

  shootBoomerang() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const bufLen = Math.floor(ctx.sampleRate * 0.3)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'bandpass'; flt.Q.value = 4
    flt.frequency.setValueAtTime(380, t)
    flt.frequency.exponentialRampToValueAtTime(1600, t + 0.15)
    flt.frequency.exponentialRampToValueAtTime(500, t + 0.3)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.3, t)
    ng.gain.setValueAtTime(0.3, t + 0.05)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    noise.connect(flt); flt.connect(ng); ng.connect(out)
    noise.start(t)
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.15)
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.3)
    og.gain.setValueAtTime(0.09, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(og); og.connect(out)
    osc.start(t); osc.stop(t + 0.3)
  }

  shootAxe() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(240, t)
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.22)
    og.gain.setValueAtTime(0.24, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    osc.connect(og); og.connect(out)
    osc.start(t); osc.stop(t + 0.24)
    const bufLen = Math.floor(ctx.sampleRate * 0.2)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'bandpass'; flt.Q.value = 1.8
    flt.frequency.setValueAtTime(900, t)
    flt.frequency.exponentialRampToValueAtTime(160, t + 0.2)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.22, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    noise.connect(flt); flt.connect(ng); ng.connect(out)
    noise.start(t)
  }

  shootMelee() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const bufLen = Math.floor(ctx.sampleRate * 0.13)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'highpass'
    flt.frequency.setValueAtTime(2200, t)
    flt.frequency.exponentialRampToValueAtTime(4500, t + 0.07)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.26, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11)
    noise.connect(flt); flt.connect(ng); ng.connect(out)
    noise.start(t)
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.13)
    og.gain.setValueAtTime(0.11, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
    osc.connect(og); og.connect(out)
    osc.start(t); osc.stop(t + 0.13)
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

  bloodNova() {
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime

    // Deep bass thud
    const sub = ctx.createOscillator()
    const subG = ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(55, t)
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.9)
    subG.gain.setValueAtTime(0.7, t)
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.95)
    sub.connect(subG); subG.connect(out)
    sub.start(t); sub.stop(t + 0.95)

    // Dark whoosh (filtered noise)
    const bufLen = Math.floor(ctx.sampleRate * 0.85)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 0.4)
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const flt = ctx.createBiquadFilter()
    flt.type = 'bandpass'
    flt.frequency.setValueAtTime(350, t)
    flt.frequency.exponentialRampToValueAtTime(80, t + 0.85)
    flt.Q.value = 0.8
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.45, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
    noise.connect(flt); flt.connect(ng); ng.connect(out)
    noise.start(t)

    // High sinister tone sweep
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.7)
    og.gain.setValueAtTime(0.18, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.75)
    osc.connect(og); og.connect(out)
    osc.start(t); osc.stop(t + 0.75)
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

  healCollect() {
    const now = Date.now()
    if (now - this.healLastPlayed < 100) return
    this.healLastPlayed = now
    const r = this.getCtx()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(i === 0 ? 440 : 660, t + i * 0.07)
      osc.frequency.exponentialRampToValueAtTime(i === 0 ? 550 : 880, t + i * 0.07 + 0.18)
      gain.gain.setValueAtTime(0, t + i * 0.07)
      gain.gain.linearRampToValueAtTime(0.12, t + i * 0.07 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.22)
      osc.connect(gain); gain.connect(out)
      osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.25)
    }
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

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(gain); gain.connect(this.master!)
    osc.start(t); osc.stop(t + 0.6)
    console.log('[Sound] Test A (via master gain) scheduled at t =', t, '— should hear 440 Hz')

    const osc2 = ctx.createOscillator()
    osc2.frequency.value = 880
    osc2.connect(ctx.destination)
    osc2.start(t + 0.7); osc2.stop(t + 1.3)
    console.log('[Sound] Test B (direct to destination) at t =', t + 0.7, '— should hear 880 Hz')
  }

  destroy() {
    window.removeEventListener('keydown', this.resumeCtx)
    window.removeEventListener('mousedown', this.resumeCtx)
  }
}

export const soundSystem = new SoundSystem()
;(window as unknown as Record<string, unknown>).soundSystem = soundSystem
