/**
 * rigCalc.js — リグ（仕掛け）の長さの計算（全長・底からの高さ・ポイントの間隔）
 *
 * 計算の決まりは仕様書 docs/spec.md の 1.3（向きと荷重）と 2.3 に書いてある。
 * 決まりを変えるときは、先に仕様書を直してから（CLAUDE.md 6章）。
 *
 * 考え方（仕様書 1.3・2.1）：
 * - 長さはすべて「経路の長さ」で測る。経路：2つのポイントの間の道すじ。
 *   パーツの中は区間を通り、パーツとパーツの間は接続を通る。接続は長さ 0
 * - リグの中に輪はないので、2つのポイントの間の経路は1本に決まる
 * - 計算はポイントの位置と接続だけを見る。パーツの種類（kind）や呼び名（role）は見ない
 *
 * 計算のしかた：
 * 1. 「節点」の地図（グラフ）を作る
 *    - 節点：接続でつながったポイントを1つにまとめたもの（仕様書 2.1 の「物理演算との対応」で、
 *      結束・連結は2つのパーツのポイントを同じ節点にする、と決めている）
 *    - 節点と節点の間の線（辺）：パーツの中の区間。長さはポイントの位置の差
 *    - グラフ：点（節点）と、点と点を結ぶ線（辺）でできた図のこと。数学の言葉
 * 2. タックル側の端からグラフをたどって、各節点までの経路の長さと「1つタックル側の節点」を出す
 * 3. それを使って、全長・底からの高さ・分かれた先の長さを出す
 *
 * つながっている所：
 * - rig.js の toLength・isValidPosition で、使えない位置を 0 にそろえる
 * - これから作る仕掛けエディタ（Issue #3）が結果を画面に出す
 * - これから作る仕掛け図（Issue #4）が、経路と長さを使って図を描く
 * - rigLayout.js が、グラフと walkFrom・nodeOfPoint を使って図の置き方を決める
 * - rigCalc.test.js が試験する
 */
import { toLength, isValidPosition, pointExists } from './rig.js'

/**
 * ポイントを指す文字（キー）を作る。Map のキーに使う。
 *
 * なぜ文字にするか：JavaScript の Map は、{ part, point } のような入れ物をキーにすると
 * 「中身が同じでも別の物」として扱う。文字にすれば中身が同じなら同じキーになる。
 * 区切りの「#」は、UUID とポイントの短い名前には出てこない文字として選んだ。
 *
 * @param {string} partId パーツの id
 * @param {string} pointId ポイントの id
 * @returns {string} キー（例："3f2b...#e1"）
 */
function pointKey(partId, pointId) {
  return `${partId}#${pointId}`
}

/**
 * 警告の種類（code）。画面は code を見て、分かりやすい文に直して出す。
 *
 * - noTackleSide：タックル側の端（tackleSide）が選ばれていない・見つからない。長さを出せない
 * - refNotFound：lengthStart・lengthEnd・bottom が、もうないポイントを指している（null と同じ扱い）
 * - refUnreachable：lengthStart・lengthEnd・bottom が、タックル側の端とつながっていないポイントを指している
 * - noBottom：底の起点（bottom）がまだ選ばれていない。高さを出さない（仕様書 2.3）
 * - badPosition：ポイントの位置がマイナス・数でない。計算では 0 として扱う（仕様書 2.2）
 * - duplicatePointId：1つのパーツの中に、同じ id のポイントが2つある。あとのほうを無視する
 * - badJointEnd：接続が、もうないパーツ・ポイントを指している。その相手は無視する
 * - unreachablePart：タックル側の端とつながっていないパーツ。計算から外す
 * - loop：つながりが輪になっている。経路が1本に決まらないので、長さが正しくないかもしれない
 */

/**
 * リグから、節点と区間のグラフを作る。
 *
 * @param {object} rig リグ（仕様書 2.2 の形）
 * @returns {{
 *   nodeOf: Map<string, string>,
 *   pointsOf: Map<string, Array<{ part: string, point: string }>>,
 *   adjacency: Map<string, Array<{ to: string, length: number, edge: number }>>,
 *   hasLoop: boolean,
 *   warnings: object[]
 * }}
 *   - nodeOf：ポイントのキー → そのポイントが属する節点の名前
 *   - pointsOf：節点の名前 → その節点にまとまったポイントの並び
 *   - adjacency：節点の名前 → となりの節点と、そこまでの区間の長さ（edge は区間の通し番号）
 *   - hasLoop：輪が見つかったか
 *   - warnings：作る途中で見つかった警告
 */
export function buildRigGraph(rig) {
  const warnings = []
  const parts = rig.parts ?? []

  // --- 1. すべてのポイントを集める ---
  // allPoints：キー → { part, point }。あとで「指す先が本当にあるか」を引くのにも使う
  const allPoints = new Map()
  // sortedPointsOfPart：パーツ id → 位置の順に並べたポイント（区間を作るのに使う）
  const sortedPointsOfPart = new Map()

  for (const part of parts) {
    const seen = new Set()
    const list = []
    for (const point of part.points ?? []) {
      if (seen.has(point.id)) {
        warnings.push({ code: 'duplicatePointId', part: part.id, point: point.id })
        continue
      }
      seen.add(point.id)
      if (!isValidPosition(point.at) || !isValidPosition(point.to)) {
        warnings.push({ code: 'badPosition', part: part.id, point: point.id })
      }
      allPoints.set(pointKey(part.id, point.id), { part: part.id, point: point.id })
      list.push({ id: point.id, at: toLength(point.at) })
    }
    // 位置の小さい順に並べる。区間は「となり合うポイントの間」なので（仕様書 2.2「区間」）。
    // 幅のあるポイントも at（始まり）で並べる（仕様書 2.3：Phase 1〜4 は at で測る）。
    // sort は同じ位置のものの順番を変えない（安定な並べ替え）ので、
    // 位置 0 が並ぶ金具は、データに書いた順のまま区間でつながる。
    list.sort((x, y) => x.at - y.at)
    sortedPointsOfPart.set(part.id, list)
  }

  // --- 2. 接続でつながったポイントを、1つの節点にまとめる ---
  // まとめ方：各ポイントに「代表」を持たせ、つながったら片方の代表をもう片方に向ける。
  // 代表をたどっていった先が同じなら、同じ節点（「Union-Find」と呼ばれるやり方）。
  const leader = new Map()
  for (const key of allPoints.keys()) leader.set(key, key)

  /** 代表をたどって、いちばん上の代表（節点の名前）を返す */
  const findRoot = (key) => {
    let current = key
    while (leader.get(current) !== current) current = leader.get(current)
    return current
  }

  for (const joint of rig.joints ?? []) {
    // 本当にあるポイントだけを相手にする（消したパーツを指したままの接続があっても止まらないように）
    const keys = []
    for (const end of joint.ends ?? []) {
      const key = pointKey(end.part, end.point)
      if (allPoints.has(key)) keys.push(key)
      else warnings.push({ code: 'badJointEnd', joint: joint.id })
    }
    // 相手が1つだけ（玉留めなど）なら、まとめるものがない。
    // 3つ以上なら、全部を1つ目と同じ節点にする【要確認：ふつうは2つ】
    for (const key of keys.slice(1)) {
      const a = findRoot(keys[0])
      const b = findRoot(key)
      if (a !== b) leader.set(b, a)
    }
  }

  const nodeOf = new Map()
  const pointsOf = new Map()
  for (const [key, ref] of allPoints) {
    const node = findRoot(key)
    nodeOf.set(key, node)
    if (!pointsOf.has(node)) pointsOf.set(node, [])
    pointsOf.get(node).push(ref)
  }

  // --- 3. 区間を、節点と節点の間の線にする ---
  const adjacency = new Map()
  for (const node of pointsOf.keys()) adjacency.set(node, [])

  let hasLoop = false
  let edgeNumber = 0
  for (const part of parts) {
    const list = sortedPointsOfPart.get(part.id)
    for (let i = 1; i < list.length; i++) {
      const from = nodeOf.get(pointKey(part.id, list[i - 1].id))
      const to = nodeOf.get(pointKey(part.id, list[i].id))
      const length = list[i].at - list[i - 1].at
      if (from === to) {
        // 区間の両端が同じ節点 ＝ 糸の2つのポイントを接続でつないだ ＝ 輪になっている
        hasLoop = true
        continue
      }
      // 線には向きがないので、両方の節点の「となり」に入れる
      adjacency.get(from).push({ to, length, edge: edgeNumber })
      adjacency.get(to).push({ to: from, length, edge: edgeNumber })
      edgeNumber++
    }
  }

  return { nodeOf, pointsOf, adjacency, hasLoop, warnings }
}

/**
 * ある節点からグラフをたどって、すべての節点までの経路の長さを出す。
 *
 * たどり方：近い順に1つずつ広げていく（幅優先探索）。輪がないので、どの節点への道も1本だけ。
 *
 * 外でも使う：rigLayout.js（図の置き方）が、タックル側の端からの「1つ手前の節点」を使う。
 *
 * @param {ReturnType<typeof buildRigGraph>} graph グラフ
 * @param {string} startNode たどり始める節点
 * @returns {{ distance: Map<string, number>, parent: Map<string, string | null>, foundLoop: boolean }}
 *   - distance：節点 → 経路の長さ（cm）。たどり着けない節点は入っていない
 *   - parent：節点 → 1つ手前（startNode 側）の節点。startNode は null
 *   - foundLoop：たどる途中で輪が見つかったか
 */
export function walkFrom(graph, startNode) {
  const distance = new Map([[startNode, 0]])
  const parent = new Map([[startNode, null]])
  // parentEdge：その節点に来るときに通った線の番号（来た道を「輪」とまちがえないため）
  const parentEdge = new Map([[startNode, -1]])
  const queue = [startNode]
  let foundLoop = false

  while (queue.length > 0) {
    const current = queue.shift()
    for (const { to, length, edge } of graph.adjacency.get(current) ?? []) {
      if (edge === parentEdge.get(current)) continue // 来た道を戻るだけなので飛ばす
      if (distance.has(to)) {
        // 来た道以外から、もう着いた節点に着いた ＝ 道が2本ある ＝ 輪
        foundLoop = true
        continue
      }
      distance.set(to, distance.get(current) + length)
      parent.set(to, current)
      parentEdge.set(to, edge)
      queue.push(to)
    }
  }
  return { distance, parent, foundLoop }
}

/**
 * { part, point } で指したポイントが、どの節点に属するかを引く。
 *
 * @param {ReturnType<typeof buildRigGraph>} graph グラフ
 * @param {{ part: string, point: string } | null | undefined} ref 指す先
 * @returns {string | null} 節点の名前。ないポイントなら null
 */
export function nodeOfPoint(graph, ref) {
  if (!ref) return null
  return graph.nodeOf.get(pointKey(ref.part, ref.point)) ?? null
}

/**
 * 2つのポイントの間の経路の長さを出す（ポイントの間隔。仕様書 2.3）。
 *
 * 例：枝ス1と枝ス2の付け根の間隔 → pathLength(graph, { part: 幹糸, point: 'e1' }, { part: 幹糸, point: 'e2' })
 *
 * @param {ReturnType<typeof buildRigGraph>} graph buildRigGraph で作ったグラフ
 * @param {{ part: string, point: string }} from 片方のポイント
 * @param {{ part: string, point: string }} to もう片方のポイント
 * @returns {number | null} 経路の長さ（cm）。どちらかが見つからない・つながっていないなら null
 */
export function pathLength(graph, from, to) {
  if (!from || !to) return null
  const a = graph.nodeOf.get(pointKey(from.part, from.point))
  const b = graph.nodeOf.get(pointKey(to.part, to.point))
  if (a === undefined || b === undefined) return null
  return walkFrom(graph, a).distance.get(b) ?? null
}

/**
 * リグの長さをまとめて計算する（仕様書 2.3）。
 *
 * @param {object} rig リグ（仕様書 2.2 の形）
 * @returns {{
 *   graph: ReturnType<typeof buildRigGraph>,
 *   totalLength: number | null,
 *   lengthStart: { part: string, point: string } | null,
 *   lengthEnd: { part: string, point: string } | null,
 *   tips: Array<{ points: Array<{ part: string, point: string }>, distance: number }>,
 *   bottom: { part: string, point: string } | null,
 *   heights: Array<{ part: string, point: string, height: number, onBottom: boolean }> | null,
 *   branches: Array<{ points: Array<{ part: string, point: string }>, height: number,
 *     tips: Array<{ points: Array<{ part: string, point: string }>, length: number }> }> | null,
 *   unreachableParts: string[],
 *   warnings: object[]
 * }}
 *   - graph：作ったグラフ。画面で pathLength（間隔）を何度も出すときに使い回す
 *   - totalLength：全長（cm）。タックル側の端がなければ null
 *   - lengthStart・lengthEnd：実際に使った全長の起点・終点（null のときに自動で決めた先も入る）
 *   - tips：先端（そこから先側に何もつながっていない節点）と、タックル側の端からの経路の長さ
 *   - bottom：実際に使った底の起点。選ばれていない・見つからないなら null
 *   - heights：底の起点からタックル側の端までの経路の上にあるポイントの、底からの高さ。
 *     底の起点より先側のポイントは onBottom: true（「底」と表示。数値は 0）。bottom がなければ null
 *   - branches：その経路から分かれる所（分岐点）ごとの、分岐点の高さと、分かれた先の先端までの経路の長さ。
 *     例：付け根の高さ 125cm・枝ス 30cm。bottom がなければ null
 *   - unreachableParts：タックル側の端とつながっていないパーツの id
 *   - warnings：警告の並び（種類は上の「警告の種類」）
 */
export function measureRig(rig) {
  const graph = buildRigGraph(rig)
  const warnings = [...graph.warnings]

  const empty = {
    graph,
    totalLength: null,
    lengthStart: null,
    lengthEnd: null,
    tips: [],
    bottom: null,
    heights: null,
    branches: null,
    unreachableParts: [],
    warnings,
  }

  // --- 1. タックル側の端から、全部の節点までの経路の長さ ---
  // タックル側の端がないと、向き（タックル側・先側）が決まらないので、何も出せない
  if (!pointExists(rig, rig.tackleSide)) {
    warnings.push({ code: 'noTackleSide' })
    return empty
  }
  const tackleNode = graph.nodeOf.get(pointKey(rig.tackleSide.part, rig.tackleSide.point))
  const fromTackle = walkFrom(graph, tackleNode)
  if (graph.hasLoop || fromTackle.foundLoop) warnings.push({ code: 'loop' })

  // つながっていないパーツ：そのパーツのポイントが、どれもたどり着けなかったもの
  const unreachableParts = []
  for (const part of rig.parts ?? []) {
    const reached = (part.points ?? []).some((point) =>
      fromTackle.distance.has(graph.nodeOf.get(pointKey(part.id, point.id))),
    )
    if (!reached) {
      unreachableParts.push(part.id)
      warnings.push({ code: 'unreachablePart', part: part.id })
    }
  }

  /**
   * lengthStart・lengthEnd・bottom の指す先を確かめて、使える節点を返す。
   * 見つからない・つながっていないなら警告を出して null（＝選んでいないのと同じ扱い。仕様書 2.3）。
   */
  const resolve = (field) => {
    const ref = rig[field]
    if (!ref) return null
    if (!pointExists(rig, ref)) {
      warnings.push({ code: 'refNotFound', field })
      return null
    }
    const node = graph.nodeOf.get(pointKey(ref.part, ref.point))
    if (!fromTackle.distance.has(node)) {
      warnings.push({ code: 'refUnreachable', field })
      return null
    }
    return { ref: { part: ref.part, point: ref.point }, node }
  }

  // --- 2. 先端 ---
  // 先端：となりが1つしかない節点（行き止まり）。ただしタックル側の端は先端ではない。
  // ビーズのように糸の途中に乗っているパーツは、糸と同じ節点にまとまるので行き止まりにならない
  // （仕様書 1.3「先端」）。
  const tips = []
  for (const [node, distance] of fromTackle.distance) {
    if (node === tackleNode) continue
    if (graph.adjacency.get(node).length <= 1) {
      tips.push({ node, points: graph.pointsOf.get(node), distance })
    }
  }

  // --- 3. 全長 ---
  // 起点：lengthStart。なければタックル側の端（仕様書 2.3）
  const start = resolve('lengthStart') ?? {
    ref: { part: rig.tackleSide.part, point: rig.tackleSide.point },
    node: tackleNode,
  }
  // 起点が タックル側の端と違うときは、起点から測り直す
  const fromStart = start.node === tackleNode ? fromTackle : walkFrom(graph, start.node)

  // 終点：lengthEnd。なければ、起点からいちばん遠い先端
  let end = resolve('lengthEnd')
  if (!end) {
    let farthest = null
    for (const tip of tips) {
      const d = fromStart.distance.get(tip.node)
      // 同じ長さの先端が2つあるときは、先に見つかったほう（パーツの並びが前のほう）にする
      if (farthest === null || d > farthest.distance) farthest = { tip, distance: d }
    }
    end = farthest
      ? { ref: farthest.tip.points[0], node: farthest.tip.node }
      : // 先端が1つもない（タックル側の端だけ）なら、全長は 0
        { ref: start.ref, node: start.node }
  }
  const totalLength = fromStart.distance.get(end.node) ?? 0

  // --- 4. 底からの高さ ---
  const bottom = resolve('bottom')
  let heights = null
  let branches = null
  if (!bottom) {
    // 底の起点を選んでいない（または指す先がない）なら、高さは出さない（仕様書 2.3）
    if (!rig.bottom) warnings.push({ code: 'noBottom' })
  } else {
    ;({ heights, branches } = measureHeights(graph, fromTackle, bottom.node))
  }

  return {
    graph,
    totalLength,
    lengthStart: start.ref,
    lengthEnd: end.ref,
    tips: tips.map(({ points, distance }) => ({ points, distance })),
    bottom: bottom ? bottom.ref : null,
    heights,
    branches,
    unreachableParts,
    warnings,
  }
}

/**
 * 底からの高さと、分かれた先の長さを出す（measureRig の中で使う）。
 *
 * 1. 底の起点から「1つタックル側の節点」を順にたどると、タックル側の端までの経路が出る。
 *    この経路の上のポイントだけ、高さを出す（仕様書 2.3）
 * 2. 経路の上の節点から、経路でない向きに分かれる所が分岐点。分かれた先は、高さではなく
 *    「分岐点からの経路の長さ」を出す（分かれた先は潮で流れるので、高さにすると実際とずれるため）
 * 3. 底の起点より先側（底の起点を通らないとタックル側に行けない所）は「底」（高さ 0）
 *
 * @param {ReturnType<typeof buildRigGraph>} graph グラフ
 * @param {ReturnType<typeof walkFrom>} fromTackle タックル側の端からたどった結果
 * @param {string} bottomNode 底の起点の節点
 * @returns {{ heights: object[], branches: object[] }} measureRig の heights・branches
 */
function measureHeights(graph, fromTackle, bottomNode) {
  const bottomDistance = fromTackle.distance.get(bottomNode)

  // --- 経路（底の起点 → タックル側の端）の節点を集める ---
  // parent（1つタックル側の節点）をたどると、タックル側の端（parent が null）で止まる
  const onPath = new Set()
  for (let node = bottomNode; node !== null; node = fromTackle.parent.get(node)) {
    onPath.add(node)
  }

  // --- 底の起点より先側の節点を集める ---
  // 底の起点から、タックル側（parent）以外の向きに広げていけば、底より先側だけが集まる
  const beyondBottom = new Set()
  const stack = [bottomNode]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const { to } of graph.adjacency.get(current)) {
      if (to === fromTackle.parent.get(current) || beyondBottom.has(to) || to === bottomNode) continue
      beyondBottom.add(to)
      stack.push(to)
    }
  }

  // --- 高さ ---
  const heights = []
  for (const [node, points] of graph.pointsOf) {
    if (onPath.has(node)) {
      // 経路の上なので、底の起点までの長さ ＝ （タックル側の端から底の起点まで）−（タックル側の端からここまで）
      const height = bottomDistance - fromTackle.distance.get(node)
      for (const ref of points) heights.push({ ...ref, height, onBottom: false })
    } else if (beyondBottom.has(node)) {
      for (const ref of points) heights.push({ ...ref, height: 0, onBottom: true })
    }
  }
  // 高い順（タックル側から）に並べる。画面で上から並べやすいように
  heights.sort((x, y) => y.height - x.height)

  // --- 分岐点と、分かれた先 ---
  const branches = []
  for (const node of onPath) {
    if (node === bottomNode) continue // 底の起点の先は「底」として上で扱った
    const tipsHere = []
    for (const { to, length } of graph.adjacency.get(node)) {
      // 経路の上の向き（タックル側・底側）は分かれた先ではない
      if (onPath.has(to)) continue
      // 分かれた先を、分岐点から遠ざかる向きにたどって、先端（行き止まり）を集める
      collectTips(graph, to, length, new Set([node]), tipsHere)
    }
    if (tipsHere.length > 0) {
      branches.push({
        points: graph.pointsOf.get(node),
        height: bottomDistance - fromTackle.distance.get(node),
        tips: tipsHere,
      })
    }
  }
  branches.sort((x, y) => y.height - x.height)

  return { heights, branches }
}

/**
 * 分かれた先をたどって、先端までの経路の長さを集める（measureHeights の中で使う）。
 *
 * 自分の中から自分を呼ぶ（再帰）書き方。分かれた先がさらに分かれていても（天秤の先の枝スなど）、
 * 同じ手順で奥までたどれるため。
 *
 * @param {ReturnType<typeof buildRigGraph>} graph グラフ
 * @param {string} node いまの節点
 * @param {number} length 分岐点からいまの節点までの経路の長さ
 * @param {Set<string>} visited もう通った節点。戻らないため。
 *   ふつうは1つ手前の節点だけで足りるが、まちがって輪があると、いつまでも回り続けてしまうので全部覚える
 * @param {Array<object>} out 見つけた先端を入れる並び
 */
function collectTips(graph, node, length, visited, out) {
  visited.add(node)
  const next = graph.adjacency.get(node).filter(({ to }) => !visited.has(to))
  if (next.length === 0) {
    out.push({ points: graph.pointsOf.get(node), length })
    return
  }
  for (const { to, length: sectionLength } of next) {
    collectTips(graph, to, length + sectionLength, visited, out)
  }
}
