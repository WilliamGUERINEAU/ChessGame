import type { SoundCue } from './game/effects'

/**
 * Petits sons synthétisés par le navigateur (Web Audio) : aucun fichier à charger.
 * Le choix « muet » est mémorisé sur l'appareil.
 */
const MUTE_KEY = 'gambit-rogue.muted'

let context: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Préférence non mémorisée : tant pis.
  }
}

/** Une note : fréquence de départ et d'arrivée (Hz), durée (s), forme d'onde, volume. */
interface Note {
  readonly from: number
  readonly to: number
  readonly duration: number
  readonly wave: OscillatorType
  readonly volume: number
  readonly delay?: number
}

const CUES: Readonly<Record<Exclude<SoundCue, null>, readonly Note[]>> = {
  move: [{ from: 420, to: 360, duration: 0.07, wave: 'triangle', volume: 0.12 }],
  hit: [{ from: 220, to: 110, duration: 0.12, wave: 'square', volume: 0.09 }],
  capture: [
    { from: 300, to: 90, duration: 0.18, wave: 'sawtooth', volume: 0.08 },
    { from: 660, to: 880, duration: 0.08, wave: 'triangle', volume: 0.08, delay: 0.1 },
  ],
  promote: [
    { from: 523, to: 523, duration: 0.09, wave: 'triangle', volume: 0.1 },
    { from: 784, to: 784, duration: 0.14, wave: 'triangle', volume: 0.1, delay: 0.09 },
  ],
  reinforce: [{ from: 160, to: 240, duration: 0.25, wave: 'square', volume: 0.07 }],
  win: [
    { from: 523, to: 523, duration: 0.12, wave: 'triangle', volume: 0.11 },
    { from: 659, to: 659, duration: 0.12, wave: 'triangle', volume: 0.11, delay: 0.12 },
    { from: 784, to: 784, duration: 0.25, wave: 'triangle', volume: 0.11, delay: 0.24 },
  ],
  lose: [
    { from: 392, to: 370, duration: 0.18, wave: 'triangle', volume: 0.1 },
    { from: 311, to: 196, duration: 0.4, wave: 'triangle', volume: 0.1, delay: 0.18 },
  ],
}

export function playCue(cue: SoundCue): void {
  if (!cue || muted) return
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    for (const note of CUES[cue]) {
      const start = now + (note.delay ?? 0)
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = note.wave
      oscillator.frequency.setValueAtTime(note.from, start)
      oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.duration)
      gain.gain.setValueAtTime(note.volume, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + note.duration + 0.02)
    }
  } catch {
    // Pas d'audio disponible : le jeu reste muet.
  }
}
