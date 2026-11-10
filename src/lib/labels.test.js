/**
 * labels.test.js — labels.js（画面に出す名前・文字）の試験
 */
import { describe, it, expect } from 'vitest'
import { formatCm, partTitle, productShortName, partCaption } from './labels.js'
import { createPart } from './rig.js'

describe('formatCm：長さの書き方', () => {
  it('整数はそのまま、小数は第1位まで', () => {
    expect(formatCm(110)).toBe('110cm')
    expect(formatCm(12.5)).toBe('12.5cm')
    expect(formatCm(0.1 + 0.2)).toBe('0.3cm')
  })
})

describe('パーツの名前と説明', () => {
  it('呼び名があれば呼び名、なければ種類の名前', () => {
    expect(partTitle(createPart('line', { role: 'mikiito' }))).toBe('幹糸')
    expect(partTitle(createPart('line'))).toBe('糸')
    expect(partTitle(createPart('sinker'))).toBe('オモリ')
  })

  it('製品の短い名前は「（標準）」を外す', () => {
    expect(productShortName('std-fluoro-5')).toBe('フロロ 5号')
    expect(productShortName(null)).toBeNull()
  })

  it('糸の説明は「呼び名 製品 長さ」', () => {
    const line = createPart('line', { role: 'mikiito', product: 'std-fluoro-5', length: 110 })
    expect(partCaption(line)).toBe('幹糸 フロロ 5号 110cm')
  })

  it('製品のない糸は「呼び名 長さ」', () => {
    expect(partCaption(createPart('line', { role: 'edasu', length: 30 }))).toBe('枝ス 30cm')
  })

  it('金具は製品の名前、製品がなければ種類の名前', () => {
    expect(partCaption(createPart('swivel', { product: 'std-swivel-8' }))).toBe('サルカン 8号')
    expect(partCaption(createPart('swivel'))).toBe('サルカン')
  })
})
