/**
 * rigCalc.test.js — rig.js と rigCalc.js の試験
 *
 * 決まりは仕様書 docs/spec.md の 2.2・2.3。
 * 試験に出てくる仕掛けは、計算を確かめるための例で、実際のおすすめ仕掛けではない。
 */
import { describe, it, expect } from 'vitest'
import { createPart, createRig, toLength, RIG_SCHEMA_VERSION } from './rig.js'
import { measureRig } from './rigCalc.js'

/**
 * 試験用の胴付き2本針の仕掛けを作る。
 *
 * 上から：道糸 → サルカン → 幹糸50 → 枝スA(40) → 幹糸80 → 枝スB(40) → 捨て糸50 → オモリ
 * 全長は 50 + 80 + 50 = 180cm（道糸・金具・オモリの長さは 0）
 */
function sampleDozuki() {
  return createRig({
    name: '試験用 胴付き2本針',
    parts: [
      createPart('line', { role: 'michi', material: 'pe', gou: 2, length: 10000 }),
      createPart('connector', { subtype: 'swivel' }),
      createPart('line', { role: 'mikiito', gou: 4, length: 50 }),
      createPart('branch', { id: 'A', line: { material: 'fluoro', gou: 3, length: 40 } }),
      createPart('line', { role: 'mikiito', gou: 4, length: 80 }),
      createPart('branch', { id: 'B', line: { material: 'fluoro', gou: 3, length: 40 } }),
      createPart('line', { role: 'sute', gou: 2, length: 50 }),
      createPart('sinker', { weight: 80 }),
    ],
  })
}

describe('toLength：長さとして使える数にする', () => {
  it('ふつうの数と、数の文字はそのまま', () => {
    expect(toLength(12.5)).toBe(12.5)
    expect(toLength('30')).toBe(30)
  })

  it('マイナス・数でない文字・空っぽは 0', () => {
    expect(toLength(-5)).toBe(0)
    expect(toLength('abc')).toBe(0)
    expect(toLength(undefined)).toBe(0)
    expect(toLength(null)).toBe(0)
  })
})

describe('createPart / createRig：データを作る', () => {
  it('仕掛けには版と UUID が付く', () => {
    const rig = createRig()
    expect(rig.schemaVersion).toBe(RIG_SCHEMA_VERSION)
    expect(rig.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(rig.parts).toEqual([])
  })

  it('枝スは長さを指定しても軸の長さは 0', () => {
    expect(createPart('branch', { length: 30 }).length).toBe(0)
  })

  it('枝スを2本作っても、中の糸の情報は別々（片方を変えても他方は変わらない）', () => {
    const a = createPart('branch')
    const b = createPart('branch')
    a.line.length = 40
    expect(b.line.length).toBe(0)
  })

  it('知らない種類はエラーにする', () => {
    expect(() => createPart('kani')).toThrow()
  })
})

describe('measureRig：長さの計算', () => {
  it('全長は道糸を除いた軸の長さの合計', () => {
    expect(measureRig(sampleDozuki()).totalLength).toBe(180)
  })

  it('オモリがあれば、オモリの上端から高さを測る', () => {
    const m = measureRig(sampleDozuki())
    expect(m.baseFrom).toBe('sinker')
    // 枝スAの付け根は上から50cm → オモリ（上から180cm）から 130cm 上
    // 枝スBの付け根は上から130cm → オモリから 50cm 上
    expect(m.branches.map((b) => [b.id, b.heightFromBase])).toEqual([
      ['A', 130],
      ['B', 50],
    ])
  })

  it('針先の高さの目安は、底からの高さ − 枝スの長さ', () => {
    const m = measureRig(sampleDozuki())
    expect(m.branches.map((b) => b.hookTipHeight)).toEqual([90, 10])
  })

  it('枝スが長くて底に届くときは、針先の高さは 0 で止める', () => {
    const rig = sampleDozuki()
    rig.parts[5].line.length = 70 // 枝スB（底から50cm）を 70cm にする
    expect(measureRig(rig).branches[1].hookTipHeight).toBe(0)
  })

  it('枝スの間隔は、となり合う付け根の距離', () => {
    expect(measureRig(sampleDozuki()).branchSpacings).toEqual([80])
  })

  it('パーツの位置（上からと下から）', () => {
    const m = measureRig(sampleDozuki())
    // 捨て糸は上から 130〜180cm、下の端からの距離は 0
    const sute = m.parts[5]
    expect([sute.kind, sute.top, sute.bottom, sute.fromBottomEnd]).toEqual(['line', 130, 180, 0])
    // 道糸は計算から外れるので、パーツの数は 8 − 1 = 7
    expect(m.parts).toHaveLength(7)
  })

  it('オモリがなければ、軸のいちばん下の端から測る', () => {
    const rig = sampleDozuki()
    rig.parts.pop() // オモリを外す
    const m = measureRig(rig)
    expect(m.baseFrom).toBe('bottom')
    expect(m.branches[1].heightFromBase).toBe(50) // 捨て糸50cmの分だけ上
  })

  it('オモリが2つあるときは、いちばん下のオモリから測る', () => {
    const rig = sampleDozuki()
    rig.parts.splice(6, 0, createPart('sinker', { weight: 10 })) // 捨て糸の上に小さいオモリ
    // 下のオモリは上から180cmのまま → 枝スBは 50cm 上
    expect(measureRig(rig).branches[1].heightFromBase).toBe(50)
  })

  it('長さに変な値が入っていても計算は止まらない（0 として扱う）', () => {
    const rig = sampleDozuki()
    rig.parts[2].length = 'abc' // 幹糸50 → 0
    rig.parts[4].length = -80 // 幹糸80 → 0
    expect(measureRig(rig).totalLength).toBe(50)
  })

  it('パーツが空でも計算できる', () => {
    const m = measureRig(createRig())
    expect(m.totalLength).toBe(0)
    expect(m.branches).toEqual([])
    expect(m.branchSpacings).toEqual([])
  })
})
