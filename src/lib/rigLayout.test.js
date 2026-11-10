/**
 * rigLayout.test.js — rigLayout.js（図の置き方）の試験
 *
 * 決まりは仕様書 docs/spec.md の 2.4「図の置き方（Phase 1）」。
 * 見本は samples.js のアマダイ胴付き 2本針（仕様書 2.2 の例）。
 */
import { describe, it, expect } from 'vitest'
import { createPart, createJoint } from './rig.js'
import { sampleAmadaiRig } from './samples.js'
import { layoutRig, sectionPx, PX_PER_CM, MIN_SECTION_PX, MAX_SECTION_CM } from './rigLayout.js'

/** パーツのポイントの位置を引く（試験を読みやすくするため） */
function pos(layout, partId, pointId) {
  const part = layout.parts.find((p) => p.part.id === partId)
  const point = part.points.find((p) => p.id === pointId)
  return { x: point.x, y: point.y }
}

describe('sectionPx：区間の長さを図の大きさにする', () => {
  it('ふつうは 1cm を PX_PER_CM で描く', () => {
    expect(sectionPx(40)).toEqual({ px: 40 * PX_PER_CM, cut: false })
  })

  it('短い区間（長さ 0 の金具を含む）は最低の大きさ', () => {
    expect(sectionPx(0)).toEqual({ px: MIN_SECTION_PX, cut: false })
    expect(sectionPx(5)).toEqual({ px: MIN_SECTION_PX, cut: false })
  })

  it('長い区間は上限の長さで描き、省略の印を付ける', () => {
    expect(sectionPx(1000)).toEqual({ px: MAX_SECTION_CM * PX_PER_CM, cut: true })
  })
})

describe('アマダイ胴付き 2本針の置き方', () => {
  const layout = layoutRig(sampleAmadaiRig())

  it('タックル側の端（サルカンの a）が (0, 0)', () => {
    expect(pos(layout, 'swv', 'a')).toEqual({ x: 0, y: 0 })
  })

  it('縦の経路（サルカン → 幹糸 → 捨て糸 → オモリ）は x = 0 で、下へ順に並ぶ', () => {
    const ys = [
      pos(layout, 'swv', 'a'),
      pos(layout, 'swv', 'b'),
      pos(layout, 'main', 'e1'),
      pos(layout, 'main', 'e2'),
      pos(layout, 'main', 'end'),
      pos(layout, 'snk', 'ring'),
      pos(layout, 'snk', 'tip'),
    ]
    expect(ys.every((p) => p.x === 0)).toBe(true)
    // y が上から下へ増えていく
    for (let i = 1; i < ys.length; i++) expect(ys[i].y).toBeGreaterThan(ys[i - 1].y)
  })

  it('長さの比率：e1 と e2 の間（60cm）は 60 × PX_PER_CM', () => {
    expect(pos(layout, 'main', 'e2').y - pos(layout, 'main', 'e1').y).toBe(60 * PX_PER_CM)
  })

  it('長さ 0 のサルカンも、最低の大きさで描く', () => {
    expect(pos(layout, 'swv', 'b').y).toBe(MIN_SECTION_PX)
  })

  it('枝スは付け根から横（右）に出て、針は枝スの先にある', () => {
    const root = pos(layout, 'main', 'e1')
    const tip = pos(layout, 'br1', 'end')
    expect(tip.y).toBe(root.y)
    expect(tip.x).toBe(30 * PX_PER_CM)
    expect(pos(layout, 'hook1', 'tie')).toEqual(tip)
  })

  it('底の線はオモリの下端の高さ', () => {
    expect(layout.bottomY).toBe(pos(layout, 'snk', 'tip').y)
  })

  it('分岐点の高さ：125cm と 65cm', () => {
    expect(layout.branchMarks.map((m) => m.height)).toEqual([125, 65])
    expect(layout.branchMarks[0].y).toBe(pos(layout, 'main', 'e1').y)
  })

  it('8個のパーツをすべて描く。省略の印はない', () => {
    expect(layout.parts).toHaveLength(8)
    expect(layout.cuts).toEqual([])
  })

  it('図の広がり：左は 0、右は枝スの先、下はオモリの下端', () => {
    expect(layout.bounds.minX).toBe(0)
    expect(layout.bounds.maxX).toBe(30 * PX_PER_CM)
    expect(layout.bounds.maxY).toBe(pos(layout, 'snk', 'tip').y)
  })
})

describe('いろいろな形の置き方', () => {
  it('底の起点がなくても、いちばん遠い先端まで縦に描く（底の線はなし）', () => {
    const rig = sampleAmadaiRig()
    rig.bottom = null
    const layout = layoutRig(rig)
    expect(layout.bottomY).toBeNull()
    expect(pos(layout, 'snk', 'tip').x).toBe(0)
    expect(layout.branchMarks).toEqual([])
  })

  it('底の起点が途中なら、縦の経路はそこを通り、その先も下へ続ける', () => {
    // 枝ス2 を 200cm にすると、いちばん遠い先端は針2 になる。
    // それでも底の起点（オモリの下端）を選んでいれば、縦の経路はオモリを通る
    const rig = sampleAmadaiRig()
    rig.parts.find((p) => p.id === 'br2').points[1].at = 200
    const layout = layoutRig(rig)
    expect(pos(layout, 'snk', 'tip').x).toBe(0)
    expect(pos(layout, 'br2', 'end').x).toBeGreaterThan(0)
  })

  it('同じ所から2本出るときは、右・左の順に出す', () => {
    const rig = sampleAmadaiRig()
    rig.parts.push(createPart('line', { id: 'br3', length: 20 }))
    rig.joints.push(createJoint('knot', [{ part: 'main', point: 'e1' }, { part: 'br3', point: 'start' }]))
    const layout = layoutRig(rig)
    expect(pos(layout, 'br1', 'end').x).toBeGreaterThan(0) // 1本目は右
    expect(pos(layout, 'br3', 'end').x).toBeLessThan(0) // 2本目は左
  })

  it('横に出た先がさらに分かれるときは、下に出す', () => {
    // 枝ス1 の途中（15cm）から、10cm の糸を出す
    const rig = sampleAmadaiRig()
    rig.parts.find((p) => p.id === 'br1').points.splice(1, 0, { id: 'mid', at: 15 })
    rig.parts.push(createPart('line', { id: 'sub', length: 10 }))
    rig.joints.push(createJoint('knot', [{ part: 'br1', point: 'mid' }, { part: 'sub', point: 'start' }]))
    const layout = layoutRig(rig)
    const mid = pos(layout, 'br1', 'mid')
    expect(pos(layout, 'sub', 'end')).toEqual({ x: mid.x, y: mid.y + 10 * PX_PER_CM })
  })

  it('長い糸は省略の印を付ける', () => {
    const rig = sampleAmadaiRig()
    rig.parts.push(createPart('line', { id: 'leader', length: 300 }))
    rig.joints.push(createJoint('knot', [{ part: 'leader', point: 'end' }, { part: 'swv', point: 'a' }]))
    rig.tackleSide = { part: 'leader', point: 'start' }
    const layout = layoutRig(rig)
    expect(layout.cuts).toHaveLength(1)
    expect(pos(layout, 'swv', 'a').y).toBe(MAX_SECTION_CM * PX_PER_CM)
  })

  it('つながっていないパーツは描かない', () => {
    const rig = sampleAmadaiRig()
    rig.parts.push(createPart('line', { id: 'loose', length: 50 }))
    expect(layoutRig(rig).parts.map((p) => p.part.id)).not.toContain('loose')
  })

  it('タックル側の端がなければ、何も描かない', () => {
    const rig = sampleAmadaiRig()
    rig.tackleSide = null
    const layout = layoutRig(rig)
    expect(layout.parts).toEqual([])
    expect(layout.positions.size).toBe(0)
  })
})
