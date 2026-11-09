/**
 * rig.test.js — rig.js（データを作る・整える）の試験
 *
 * 決まりは仕様書 docs/spec.md の 2.2。
 */
import { describe, it, expect } from 'vitest'
import {
  createPart,
  createJoint,
  createRig,
  toLength,
  isValidPosition,
  partLength,
  pointExists,
  RIG_SCHEMA_VERSION,
} from './rig.js'

describe('toLength：位置・長さとして使える数にする', () => {
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

describe('isValidPosition：警告を出すかどうか', () => {
  it('書いていない・0 以上の数は OK', () => {
    expect(isValidPosition(undefined)).toBe(true)
    expect(isValidPosition(0)).toBe(true)
    expect(isValidPosition(40)).toBe(true)
  })

  it('マイナス・文字はまちがい', () => {
    expect(isValidPosition(-1)).toBe(false)
    expect(isValidPosition('40')).toBe(false)
    expect(isValidPosition(Number.NaN)).toBe(false)
  })
})

describe('createRig：リグを作る', () => {
  it('版 2 と UUID が付き、パーツ・接続は空', () => {
    const rig = createRig()
    expect(rig.schemaVersion).toBe(RIG_SCHEMA_VERSION)
    expect(RIG_SCHEMA_VERSION).toBe(2)
    expect(rig.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(rig.parts).toEqual([])
    expect(rig.joints).toEqual([])
    expect(rig.tackleSide).toBeNull()
    expect(rig.bottom).toBeNull()
  })

  it('構成タイプ（type）は持たない（仕様書 2章の冒頭）', () => {
    expect(createRig()).not.toHaveProperty('type')
  })
})

describe('createPart：パーツを作る', () => {
  it('糸は始まり start と終わり end を持ち、長さは end の位置', () => {
    const line = createPart('line', { length: 30, role: 'edasu', product: 'std-fluoro-3' })
    expect(line.points).toEqual([
      { id: 'start', at: 0 },
      { id: 'end', at: 30 },
    ])
    expect(line.role).toBe('edasu')
    expect(line.product).toBe('std-fluoro-3')
    expect(partLength(line)).toBe(30)
  })

  it('オモリは環と下端を持つ', () => {
    const sinker = createPart('sinker')
    expect(sinker.points.map((p) => [p.id, p.form])).toEqual([
      ['ring', 'ring'],
      ['tip', undefined],
    ])
  })

  it('同じ種類を2つ作っても、ポイントは別々（片方を変えても他方は変わらない）', () => {
    const a = createPart('line', { length: 10 })
    const b = createPart('line', { length: 10 })
    a.points[1].at = 99
    expect(b.points[1].at).toBe(10)
    // 2回目以降に作る糸の最初の値も変わっていない
    expect(createPart('line').points[1].at).toBe(0)
  })

  it('呼び名・メモがなければ、その項目は書かない', () => {
    const hook = createPart('hook')
    expect(hook).not.toHaveProperty('role')
    expect(hook).not.toHaveProperty('memo')
    expect(hook.product).toBeNull()
  })

  it('知らない種類はエラーにする', () => {
    expect(() => createPart('kani')).toThrow()
  })
})

describe('partLength：パーツの長さ', () => {
  it('ポイントの位置（at と to）のいちばん大きい値', () => {
    const part = { points: [{ id: 'start', at: 0 }, { id: 's', at: 40, to: 60 }, { id: 'end', at: 50 }] }
    expect(partLength(part)).toBe(60)
  })

  it('ポイントがなければ 0', () => {
    expect(partLength({ points: [] })).toBe(0)
  })
})

describe('createJoint：接続を作る', () => {
  it('結束は結び方を持つ', () => {
    const joint = createJoint('knot', [{ part: 'p1', point: 'b' }, { part: 'p2', point: 'start' }], {
      knotStyle: 'clinch',
    })
    expect(joint.type).toBe('knot')
    expect(joint.knotStyle).toBe('clinch')
    expect(joint.ends).toHaveLength(2)
  })

  it('連結・通しは結び方を持たない', () => {
    expect(createJoint('link', [{ part: 'a', point: 'x' }, { part: 'b', point: 'y' }])).not.toHaveProperty(
      'knotStyle',
    )
  })

  it('相手のいない結束（玉留め）は相手が1つ', () => {
    expect(createJoint('knot', [{ part: 'a', point: 'x' }], { knotStyle: 'tamadome' }).ends).toHaveLength(1)
  })

  it('知らない種類・相手なしはエラー', () => {
    expect(() => createJoint('glue', [{ part: 'a', point: 'x' }])).toThrow()
    expect(() => createJoint('knot', [])).toThrow()
  })
})

describe('pointExists：指したポイントがあるか', () => {
  const rig = createRig({ parts: [createPart('line', { id: 'L', length: 10 })] })

  it('あれば true', () => {
    expect(pointExists(rig, { part: 'L', point: 'end' })).toBe(true)
  })

  it('パーツかポイントがなければ false、null も false', () => {
    expect(pointExists(rig, { part: 'L', point: 'e9' })).toBe(false)
    expect(pointExists(rig, { part: 'X', point: 'end' })).toBe(false)
    expect(pointExists(rig, null)).toBe(false)
  })
})
