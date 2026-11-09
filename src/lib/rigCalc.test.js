/**
 * rigCalc.test.js — rigCalc.js（長さの計算）の試験
 *
 * 決まりは仕様書 docs/spec.md の 1.3・2.3。
 * 中心の例は、仕様書 2.2 の「例：アマダイ胴付き 2本針」をそのまま使う。
 * 仕様書の「計算の確かめ」の表と同じ答え（全長 165cm など）が出ることを確かめる。
 * 試験に出てくる仕掛けは計算を確かめるための例で、おすすめの仕掛けではない。
 */
import { describe, it, expect } from 'vitest'
import { createPart, createJoint, createRig } from './rig.js'
import { measureRig, buildRigGraph, pathLength } from './rigCalc.js'

/**
 * 仕様書 2.2 の例「アマダイ胴付き 2本針」（仕様書の JSON と同じ中身）。
 *
 * タックル側から：サルカン → 幹糸 110cm（40cm・100cm に枝ス 30cm と針）→ 捨て糸 50cm → オモリ 5cm
 *
 * @returns {object} リグ
 */
function amadaiRig() {
  return {
    schemaVersion: 2,
    id: 'rig-amadai',
    name: 'アマダイ胴付き 2本針',
    memo: '',
    derivedFrom: null,
    tackleSide: { part: 'swv', point: 'a' },
    lengthStart: null,
    lengthEnd: null,
    bottom: { part: 'snk', point: 'tip' },
    parts: [
      { id: 'swv', kind: 'swivel', product: 'std-swivel-8',
        points: [ { id: 'a', at: 0, form: 'ring' }, { id: 'b', at: 0, form: 'ring' } ] },
      { id: 'main', kind: 'line', role: 'mikiito', product: 'std-fluoro-5',
        points: [ { id: 'start', at: 0 }, { id: 'e1', at: 40 },
                  { id: 'e2', at: 100 }, { id: 'end', at: 110 } ] },
      { id: 'br1', kind: 'line', role: 'edasu', product: 'std-fluoro-3',
        points: [ { id: 'start', at: 0 }, { id: 'end', at: 30 } ] },
      { id: 'hook1', kind: 'hook', product: 'std-hook-amadai-12',
        points: [ { id: 'tie', at: 0 } ] },
      { id: 'br2', kind: 'line', role: 'edasu', product: 'std-fluoro-3',
        points: [ { id: 'start', at: 0 }, { id: 'end', at: 30 } ] },
      { id: 'hook2', kind: 'hook', product: 'std-hook-amadai-12',
        points: [ { id: 'tie', at: 0 } ] },
      { id: 'sute', kind: 'line', role: 'sute', product: 'std-nylon-3',
        points: [ { id: 'start', at: 0 }, { id: 'end', at: 50 } ] },
      { id: 'snk', kind: 'sinker', product: 'std-sinker-80',
        points: [ { id: 'ring', at: 0, form: 'ring' }, { id: 'tip', at: 5 } ] },
    ],
    joints: [
      { id: 'j1', type: 'knot', knotStyle: 'clinch',
        ends: [ { part: 'swv', point: 'b' }, { part: 'main', point: 'start' } ] },
      { id: 'j2', type: 'knot', knotStyle: 'edasu',
        ends: [ { part: 'main', point: 'e1' }, { part: 'br1', point: 'start' } ] },
      { id: 'j3', type: 'knot', knotStyle: 'sotogake',
        ends: [ { part: 'br1', point: 'end' }, { part: 'hook1', point: 'tie' } ] },
      { id: 'j4', type: 'knot', knotStyle: 'edasu',
        ends: [ { part: 'main', point: 'e2' }, { part: 'br2', point: 'start' } ] },
      { id: 'j5', type: 'knot', knotStyle: 'sotogake',
        ends: [ { part: 'br2', point: 'end' }, { part: 'hook2', point: 'tie' } ] },
      { id: 'j6', type: 'knot', knotStyle: 'densha',
        ends: [ { part: 'main', point: 'end' }, { part: 'sute', point: 'start' } ] },
      { id: 'j7', type: 'knot', knotStyle: 'clinch',
        ends: [ { part: 'sute', point: 'end' }, { part: 'snk', point: 'ring' } ] },
    ],
    layout: {},
  }
}

/** 高さの一覧から、あるポイントの高さを引く（試験を読みやすくするため） */
function heightOf(result, part, point) {
  return result.heights.find((h) => h.part === part && h.point === point)
}

/** 警告の code だけを並べる */
function codes(result) {
  return result.warnings.map((w) => w.code)
}

describe('仕様書 2.2 の例（アマダイ胴付き 2本針）', () => {
  const result = measureRig(amadaiRig())

  it('警告は出ない', () => {
    expect(result.warnings).toEqual([])
  })

  it('全長：サルカン a → いちばん遠い先端（オモリの下端）＝ 0 + 110 + 50 + 5 ＝ 165cm', () => {
    expect(result.totalLength).toBe(165)
    expect(result.lengthStart).toEqual({ part: 'swv', point: 'a' })
    expect(result.lengthEnd).toEqual({ part: 'snk', point: 'tip' })
  })

  it('枝ス1の付け根（main の e1）の高さ：5 + 50 + (110 − 40) ＝ 125cm', () => {
    expect(heightOf(result, 'main', 'e1').height).toBe(125)
    // 枝スの始まりも同じ節点（エダス結びでつながっている）なので、同じ高さ
    expect(heightOf(result, 'br1', 'start').height).toBe(125)
  })

  it('枝ス2の付け根（main の e2）の高さ：5 + 50 + (110 − 100) ＝ 65cm', () => {
    expect(heightOf(result, 'main', 'e2').height).toBe(65)
  })

  it('その他の経路の上のポイントの高さ', () => {
    expect(heightOf(result, 'swv', 'a').height).toBe(165) // タックル側の端
    expect(heightOf(result, 'main', 'end').height).toBe(55) // 幹糸と捨て糸の結び目
    expect(heightOf(result, 'snk', 'ring').height).toBe(5) // オモリの環
    expect(heightOf(result, 'snk', 'tip').height).toBe(0) // 底の起点
  })

  it('分かれた先（枝ス・針）には高さを出さない（仕様書 2.3）', () => {
    expect(heightOf(result, 'br1', 'end')).toBeUndefined()
    expect(heightOf(result, 'hook1', 'tie')).toBeUndefined()
  })

  it('分岐点ごとに「付け根の高さ」と「枝スの長さ（付け根から先端まで）」を並べて出す', () => {
    expect(result.branches.map((b) => [b.height, b.tips.map((t) => t.length)])).toEqual([
      [125, [30]],
      [65, [30]],
    ])
    // 先端は、枝スの終わりと針の結ぶ所（同じ節点）
    expect(result.branches[0].tips[0].points).toEqual([
      { part: 'br1', point: 'end' },
      { part: 'hook1', point: 'tie' },
    ])
  })

  it('枝ス1・2の付け根の間隔：100 − 40 ＝ 60cm', () => {
    const graph = buildRigGraph(amadaiRig())
    expect(pathLength(graph, { part: 'main', point: 'e1' }, { part: 'main', point: 'e2' })).toBe(60)
    // 逆向きに測っても同じ
    expect(pathLength(graph, { part: 'main', point: 'e2' }, { part: 'main', point: 'e1' })).toBe(60)
  })

  it('針から針までの経路：30 + 60 + 30 ＝ 120cm（パーツをまたいで測れる）', () => {
    expect(
      pathLength(result.graph, { part: 'hook1', point: 'tie' }, { part: 'hook2', point: 'tie' }),
    ).toBe(120)
  })

  it('先端は3つ（針2本とオモリの下端）', () => {
    expect(result.tips.map((t) => t.distance).sort((a, b) => a - b)).toEqual([70, 130, 165])
  })
})

describe('全長の起点と終点（lengthStart・lengthEnd）', () => {
  it('終点を針1にすると、サルカンから針1まで：40 + 30 ＝ 70cm', () => {
    const rig = amadaiRig()
    rig.lengthEnd = { part: 'hook1', point: 'tie' }
    expect(measureRig(rig).totalLength).toBe(70)
  })

  it('起点を幹糸の e1 にすると、いちばん遠い先端（オモリの下端）まで：70 + 50 + 5 ＝ 125cm', () => {
    const rig = amadaiRig()
    rig.lengthStart = { part: 'main', point: 'e1' }
    const result = measureRig(rig)
    expect(result.totalLength).toBe(125)
    expect(result.lengthEnd).toEqual({ part: 'snk', point: 'tip' })
  })

  it('もうないポイントを指していたら、選んでいないのと同じ扱い＋警告', () => {
    const rig = amadaiRig()
    rig.lengthEnd = { part: 'main', point: 'nai' }
    const result = measureRig(rig)
    expect(result.totalLength).toBe(165)
    expect(result.warnings).toContainEqual({ code: 'refNotFound', field: 'lengthEnd' })
  })
})

describe('底の起点（bottom）', () => {
  it('選んでいなければ、高さは出さずに警告（「底の起点を選んでください」）', () => {
    const rig = amadaiRig()
    rig.bottom = null
    const result = measureRig(rig)
    expect(result.heights).toBeNull()
    expect(result.branches).toBeNull()
    expect(codes(result)).toEqual(['noBottom'])
    // 全長は bottom と関係なく出る
    expect(result.totalLength).toBe(165)
  })

  it('もうないポイントを指していたら、選んでいないのと同じ扱い', () => {
    const rig = amadaiRig()
    rig.bottom = { part: 'nai', point: 'tip' }
    const result = measureRig(rig)
    expect(result.heights).toBeNull()
    expect(codes(result)).toEqual(['refNotFound'])
  })

  it('底の起点より先側のポイントは「底」（高さ 0・onBottom）', () => {
    // オモリの環を底の起点にすると、オモリの下端は底の起点より先側になる
    const rig = amadaiRig()
    rig.bottom = { part: 'snk', point: 'ring' }
    const result = measureRig(rig)
    expect(heightOf(result, 'snk', 'tip')).toEqual({
      part: 'snk',
      point: 'tip',
      height: 0,
      onBottom: true,
    })
    // 環から測るので、付け根の高さはオモリの長さ 5cm の分だけ低くなる
    expect(heightOf(result, 'main', 'e1').height).toBe(120)
  })

  it('タックル側のオモリを選ぶと、その先のパーツは底に寝ている扱い', () => {
    // 幹糸の e2 を底の起点にした（e2 で底に着いた）とすると、捨て糸もオモリも「底」
    const rig = amadaiRig()
    rig.bottom = { part: 'main', point: 'e2' }
    const result = measureRig(rig)
    expect(heightOf(result, 'main', 'e1').height).toBe(60)
    expect(heightOf(result, 'sute', 'end').onBottom).toBe(true)
    expect(heightOf(result, 'snk', 'tip').onBottom).toBe(true)
    // e2 から出る枝スは底の起点の先なので、分岐点の一覧には入らない（「底」として扱う）
    expect(result.branches.map((b) => b.height)).toEqual([60])
  })
})

describe('まちがった入力でも計算は止まらない', () => {
  it('位置がマイナス・数でないなら 0 として扱い、警告', () => {
    const rig = amadaiRig()
    rig.parts[6].points[1].at = 'abc' // 捨て糸の end：50 → 0
    const result = measureRig(rig)
    // 枝ス1の付け根の高さ：5 + 0 + (110 − 40) ＝ 75cm
    expect(heightOf(result, 'main', 'e1').height).toBe(75)
    // オモリの下端までは 110 + 0 + 5 ＝ 115cm になり、針2（100 + 30 ＝ 130cm）のほうが遠くなる。
    // 全長は「いちばん遠い先端」までなので 130cm
    expect(result.totalLength).toBe(130)
    expect(result.lengthEnd).toEqual({ part: 'br2', point: 'end' })
    expect(result.warnings).toContainEqual({ code: 'badPosition', part: 'sute', point: 'end' })
  })

  it('位置を書いていないのは「0」の決まりどおりなので、警告は出さない', () => {
    const rig = amadaiRig()
    delete rig.parts[0].points[0].at // サルカンの a
    expect(measureRig(rig).warnings).toEqual([])
  })

  it('タックル側の端がなければ、何も出さずに警告', () => {
    const rig = amadaiRig()
    rig.tackleSide = null
    const result = measureRig(rig)
    expect(result.totalLength).toBeNull()
    expect(result.heights).toBeNull()
    expect(codes(result)).toEqual(['noTackleSide'])
  })

  it('つながっていないパーツは計算から外し、警告', () => {
    const rig = amadaiRig()
    rig.parts.push(createPart('line', { id: 'loose', length: 500 }))
    const result = measureRig(rig)
    expect(result.totalLength).toBe(165) // 500cm の糸は入らない
    expect(result.unreachableParts).toEqual(['loose'])
    expect(codes(result)).toEqual(['unreachablePart'])
  })

  it('消したパーツを指したままの接続は、その相手を無視して警告', () => {
    const rig = amadaiRig()
    rig.joints.push(createJoint('knot', [{ part: 'main', point: 'end' }, { part: 'nai', point: 'x' }], { id: 'jx' }))
    const result = measureRig(rig)
    expect(result.totalLength).toBe(165)
    expect(result.warnings).toContainEqual({ code: 'badJointEnd', joint: 'jx' })
  })

  it('つながりが輪になっていたら警告（止まらずに終わる）', () => {
    const rig = amadaiRig()
    // 針1と針2を糸でつないで輪にする
    rig.parts.push(createPart('line', { id: 'ring', length: 10 }))
    rig.joints.push(
      createJoint('knot', [{ part: 'hook1', point: 'tie' }, { part: 'ring', point: 'start' }]),
      createJoint('knot', [{ part: 'hook2', point: 'tie' }, { part: 'ring', point: 'end' }]),
    )
    expect(codes(measureRig(rig))).toContain('loop')
  })

  it('空のリグ（パーツなし）でも止まらない', () => {
    const result = measureRig(createRig())
    expect(result.totalLength).toBeNull()
    expect(codes(result)).toEqual(['noTackleSide'])
  })
})

describe('いろいろな形', () => {
  it('ビーズ（通し）は糸の途中に乗っているだけなので、先端にならない', () => {
    const rig = amadaiRig()
    rig.parts.push(createPart('bead', { id: 'bead' }))
    rig.joints.push(createJoint('slide', [{ part: 'bead', point: 'hole' }, { part: 'sute', point: 'end' }]))
    const result = measureRig(rig)
    expect(result.tips).toHaveLength(3) // 針2本とオモリの下端のまま
    expect(result.totalLength).toBe(165)
  })

  it('道糸・リーダーを入れても、道糸の長さは 0 なのでリーダーを含めた長さになる', () => {
    const rig = amadaiRig()
    rig.parts.push(
      createPart('line', { id: 'michi', role: 'michiito' }), // 長さを入れない ＝ 0
      createPart('line', { id: 'leader', role: 'leader', length: 300 }),
    )
    rig.joints.push(
      createJoint('knot', [{ part: 'michi', point: 'end' }, { part: 'leader', point: 'start' }]),
      createJoint('knot', [{ part: 'leader', point: 'end' }, { part: 'swv', point: 'a' }]),
    )
    rig.tackleSide = { part: 'michi', point: 'start' }
    const result = measureRig(rig)
    expect(result.totalLength).toBe(465) // 0 + 300 + 165
    expect(heightOf(result, 'michi', 'start').height).toBe(465)
  })

  it('分かれた先がさらに分かれていても、先端までの長さを全部出す', () => {
    // 幹糸の e1 に三又サルカンを付け、そこから 20cm と 40cm の糸を出す
    const rig = amadaiRig()
    rig.parts.push(
      createPart('triSwivel', { id: 'tri' }),
      createPart('line', { id: 'x', length: 20 }),
      createPart('line', { id: 'y', length: 40 }),
    )
    rig.joints.push(
      createJoint('link', [{ part: 'main', point: 'e1' }, { part: 'tri', point: 'a' }]),
      createJoint('knot', [{ part: 'tri', point: 'b' }, { part: 'x', point: 'start' }]),
      createJoint('knot', [{ part: 'tri', point: 'c' }, { part: 'y', point: 'start' }]),
    )
    const result = measureRig(rig)
    const atE1 = result.branches.find((b) => b.height === 125)
    expect(atE1.tips.map((t) => t.length).sort((a, b) => a - b)).toEqual([20, 30, 40])
  })
})
