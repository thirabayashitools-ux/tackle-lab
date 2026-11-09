/**
 * buildInfo.test.js — buildInfo.js の試験
 *
 * Vitest：JavaScript の試験の道具。`npm test` で、このような *.test.js を全部動かす。
 * describe でまとまりを作り、it（または test）で1つの確かめごとを書く。
 * expect(実際の値).toBe(期待する値) で、一致しなければ試験が落ちる。
 */
import { describe, it, expect } from 'vitest'
import { formatBuildTime, getBuildInfo } from './buildInfo.js'

describe('formatBuildTime：日本時間の文字にする', () => {
  it('世界標準時（UTC）を9時間進めて日本時間にする', () => {
    // UTC の 03:50 は、日本時間の 12:50
    expect(formatBuildTime('2026-11-09T03:50:00.000Z')).toBe('2026-11-09 12:50')
  })

  it('日付をまたぐときも正しく進める', () => {
    // UTC の 11/9 20:00 は、日本時間の 11/10 05:00
    expect(formatBuildTime('2026-11-09T20:00:00.000Z')).toBe('2026-11-10 05:00')
  })

  it('0時台は 24時ではなく 00時と出す', () => {
    // hourCycle の指定を忘れると「24:05」になる環境があるので確かめておく
    expect(formatBuildTime('2026-11-09T15:05:00.000Z')).toBe('2026-11-10 00:05')
  })

  it('読めない値は「不明」にする', () => {
    expect(formatBuildTime('')).toBe('不明')
    expect(formatBuildTime('あいうえお')).toBe('不明')
  })
})

describe('getBuildInfo：画面に出す情報', () => {
  it('版は package.json の version と同じ形（数字.数字.数字）', () => {
    expect(getBuildInfo().version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('ビルド日時は「不明」ではない（Vite が値を埋め込めている）', () => {
    expect(getBuildInfo().buildTimeText).not.toBe('不明')
  })
})
