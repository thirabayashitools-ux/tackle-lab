/**
 * rigLayout.js — 仕掛け図（模式図）の置き方を決める（どのポイントを図のどこに描くか）
 *
 * 決まりは仕様書 docs/spec.md の 2.4「図の置き方（Phase 1）」。
 * 決まりを変えるときは、先に仕様書を直してから（CLAUDE.md 6章）。
 *
 * ここでは「座標（図の上の位置）」を出すだけで、絵は描かない。
 * なぜ分けるか：座標の計算は Vitest で試験できるが、絵（SVG）は目で見ないと確かめられない。
 * 分けておくと、計算のまちがいを試験で先に見つけられる。
 *
 * 座標の向き：SVG と同じく、x は右へ、y は下へ増える（数学のグラフとは y が逆）。
 * タックル側の端を (0, 0) に置き、縦の経路を下へ描く。
 *
 * 考え方（仕様書 2.4）：
 * - 縦の経路：タックル側の端 → 底の起点 → その先のいちばん遠い先端、を下へまっすぐ
 * - 分かれた先：そこから「いちばん遠い先端」までを、縦の経路と直角の向き（横）にまっすぐ。
 *   同じ所から2本以上出るときは 右・左・右… の順。横に出た先がさらに分かれたら、下へ
 * - これは図の描き方だけの決まりで、計算では特別扱いしない（仕様書 1.3「軸は作らない」）
 *
 * つながっている所：
 * - rigCalc.js：グラフ（節点と区間）・タックル側の端からのたどり方（walkFrom）・長さの計算（measureRig）
 * - components/RigDiagram.jsx：ここで出した座標を使って SVG の絵を描く
 * - rigLayout.test.js が試験する
 */
import { toLength } from './rig.js'
import { measureRig, walkFrom, nodeOfPoint } from './rigCalc.js'

/**
 * 1cm を図の上でどれだけの大きさで描くか（SVG の単位。画面の点 px とほぼ同じ）。
 * 【要確認】仕様書 2.4：触りながら直す
 */
export const PX_PER_CM = 2

/**
 * 区間を描く最低の大きさ。長さ 0 の金具（サルカンの環と環の間など）も、
 * 絵とタップする所の大きさを確保するため、これより短くは描かない。【要確認】
 */
export const MIN_SECTION_PX = 18

/**
 * これより長い区間は、この長さで描いて「≈」の省略の印を付ける（cm）。
 * 道糸・リーダーのような長い糸で、図が縦に伸びすぎないようにするため。【要確認】
 */
export const MAX_SECTION_CM = 150

/** 向き。x・y の増え方の組（例：下 = x は増えず、y が増える） */
const DOWN = { dx: 0, dy: 1 }
const RIGHT = { dx: 1, dy: 0 }
const LEFT = { dx: -1, dy: 0 }

/**
 * 区間の長さ（cm）を、図の上の大きさにする。
 *
 * @param {number} cm 区間の長さ（cm）
 * @returns {{ px: number, cut: boolean }} 図の上の大きさと、省略したか（cut）
 */
export function sectionPx(cm) {
  const length = toLength(cm)
  if (length > MAX_SECTION_CM) return { px: MAX_SECTION_CM * PX_PER_CM, cut: true }
  return { px: Math.max(MIN_SECTION_PX, length * PX_PER_CM), cut: false }
}

/**
 * リグの図の置き方を決める。
 *
 * @param {object} rig リグ（仕様書 2.2 の形）
 * @param {ReturnType<typeof measureRig>} [measure] 長さの計算の結果。
 *   すでに計算してあるときに渡すと、同じ計算を2回しないで済む
 * @returns {{
 *   positions: Map<string, { x: number, y: number }>,
 *   parts: Array<{ part: object, points: Array<{ id: string, at: number, x: number, y: number }> }>,
 *   cuts: Array<{ x: number, y: number, dir: { dx: number, dy: number } }>,
 *   bottomY: number | null,
 *   branchMarks: Array<{ x: number, y: number, height: number }>,
 *   bounds: { minX: number, maxX: number, minY: number, maxY: number },
 *   measure: ReturnType<typeof measureRig>
 * }}
 *   - positions：節点の名前 → 図の上の位置
 *   - parts：描くパーツと、そのポイントの位置（ポイントは位置 at の順）。
 *     タックル側の端とつながっていないパーツは入らない（描けないため。警告は measure に出る）
 *   - cuts：省略の印「≈」を描く所（区間のまん中）と、その区間の向き
 *   - bottomY：底の線を引く高さ。底の起点がなければ null
 *   - branchMarks：縦の経路の上の分岐点と、その底からの高さ（cm）
 *   - bounds：図の広がり（いちばん左・右・上・下）。絵の大きさは含まない
 *   - measure：長さの計算の結果（渡されなかったときは、ここで計算したもの）
 */
export function layoutRig(rig, measure = measureRig(rig)) {
  const graph = measure.graph
  const positions = new Map()
  const cuts = []

  const empty = {
    positions,
    parts: [],
    cuts,
    bottomY: null,
    branchMarks: [],
    bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    measure,
  }
  // タックル側の端がないと、どこから描き始めるか決まらない
  if (measure.totalLength === null) return empty

  const tackleNode = nodeOfPoint(graph, rig.tackleSide)
  const tree = walkFrom(graph, tackleNode)

  // --- 1. 「子」の一覧を作る ---
  // 子：1つ先側の節点。タックル側の端からたどったとき、parent（1つ手前）がその節点になっているもの。
  // こうして向きを決めておくと、あとは「先側へ」たどるだけで済む。
  const children = new Map()
  for (const node of tree.distance.keys()) children.set(node, [])
  for (const [node, parent] of tree.parent) {
    if (parent === null) continue
    // 親から子への区間の長さ（cm）。同じ2つの節点の間の区間は1本だけのはず（輪がないので）
    const edge = graph.adjacency.get(parent).find((e) => e.to === node)
    children.get(parent).push({ node, cm: edge.length })
  }

  // --- 2. 各節点から先側の「いちばん遠い先端までの長さ」（cm）---
  // 縦の経路・横の経路で、どの子へまっすぐ進むかを決めるのに使う。
  // 先端のほうから順に計算したいので、タックル側の端から遠い順に並べて計算する
  // （子は必ず親より遠いので、遠い順なら子の値が先に決まっている）。
  const reach = new Map()
  const farToNear = [...tree.distance.keys()].sort(
    (a, b) => tree.distance.get(b) - tree.distance.get(a),
  )
  for (const node of farToNear) {
    let best = 0
    for (const child of children.get(node)) best = Math.max(best, child.cm + reach.get(child.node))
    reach.set(node, best)
  }

  // --- 3. 底の起点までの道（縦の経路は必ずここを通る）---
  const bottomNode = nodeOfPoint(graph, measure.bottom)
  const toBottom = new Set()
  for (let node = bottomNode; node !== null && node !== undefined; node = tree.parent.get(node)) {
    toBottom.add(node)
  }

  /**
   * 次にまっすぐ進む子を選ぶ。
   * - 底の起点への道の上にいるうちは、その道の子（縦の経路が底の起点を通るように）
   * - それ以外は、いちばん遠い先端に向かう子。同じなら先に見つかったほう
   */
  const pickStraight = (node, candidates) => {
    if (toBottom.has(node) && node !== bottomNode) {
      const onPath = candidates.find((c) => toBottom.has(c.node))
      if (onPath) return onPath
    }
    let best = null
    for (const c of candidates) {
      if (best === null || c.cm + reach.get(c.node) > best.cm + reach.get(best.node)) best = c
    }
    return best
  }

  /**
   * 1本のまっすぐな線（鎖）を置く。置いた節点から出る、ほかの子（分かれた先）も順に置く。
   *
   * @param {string} startNode 位置が決まっている、鎖の始まりの節点
   * @param {{ dx: number, dy: number }} dir 鎖を伸ばす向き
   * @param {{ node: string, cm: number } | null} firstStep 最初に進む子（分かれた先の最初の1歩）。
   *   null なら pickStraight で選ぶ
   */
  const placeChain = (startNode, dir, firstStep) => {
    const chain = [startNode]
    let current = startNode
    let step = firstStep ?? pickStraight(current, children.get(current))
    while (step) {
      const from = positions.get(current)
      const { px, cut } = sectionPx(step.cm)
      const to = { x: from.x + dir.dx * px, y: from.y + dir.dy * px }
      positions.set(step.node, to)
      if (cut) cuts.push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, dir })
      current = step.node
      chain.push(current)
      step = pickStraight(current, children.get(current))
    }

    // 鎖の上の各節点から、まっすぐ進まなかった子を「分かれた先」として置く。
    // 鎖を全部置いてから分かれた先を置くのは、鎖の上の位置が先に決まっていないと、
    // 分かれた先の始まりの位置が分からないため。
    // 分かれた先の鎖（firstStep あり）は、始まりの節点（分岐点）を飛ばす。
    // 分岐点のほかの子は、呼んだ側の鎖が置くので、ここでも置くと同じ所を何度も置き続けてしまう。
    const first = firstStep ? 1 : 0
    for (let i = first; i < chain.length; i++) {
      const node = chain[i]
      const straight = chain[i + 1]
      const others = children.get(node).filter((c) => c.node !== straight)
      others.forEach((child, k) => {
        // 縦の鎖からは横（右・左・右…）、横の鎖からは下へ
        const branchDir = dir.dy !== 0 ? (k % 2 === 0 ? RIGHT : LEFT) : DOWN
        placeChain(node, branchDir, child)
      })
    }
  }

  positions.set(tackleNode, { x: 0, y: 0 })
  placeChain(tackleNode, DOWN, null)

  // --- 4. パーツごとに、ポイントの位置をまとめる ---
  const parts = []
  for (const part of rig.parts ?? []) {
    const points = []
    for (const point of part.points ?? []) {
      const node = nodeOfPoint(graph, { part: part.id, point: point.id })
      const pos = positions.get(node)
      if (pos) points.push({ id: point.id, at: toLength(point.at), x: pos.x, y: pos.y })
    }
    if (points.length === 0) continue // つながっていないパーツは描かない
    points.sort((a, b) => a.at - b.at)
    parts.push({ part, points })
  }

  // --- 5. 底の線と、分岐点の高さ ---
  const bottomY = bottomNode ? (positions.get(bottomNode)?.y ?? null) : null
  const branchMarks = []
  for (const branch of measure.branches ?? []) {
    const pos = positions.get(nodeOfPoint(graph, branch.points[0]))
    if (pos) branchMarks.push({ x: pos.x, y: pos.y, height: branch.height })
  }

  // --- 6. 図の広がり ---
  const xs = [...positions.values()].map((p) => p.x)
  const ys = [...positions.values()].map((p) => p.y)
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }

  return { positions, parts, cuts, bottomY, branchMarks, bounds, measure }
}
