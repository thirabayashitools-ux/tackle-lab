/**
 * rig.js — リグ（仕掛け）・パーツ・接続のデータを作る・整える
 *
 * rig（リグ）：英語で「仕掛け」のこと。このアプリでは仕掛け1つ分のデータを rig と呼ぶ。
 *
 * データの形は仕様書 docs/spec.md の 1.3（用語）と 2.1・2.2 に書いてある。
 * ここを変えるときは、先に仕様書を直してから（CLAUDE.md 6章）。
 *
 * データの形の要点（仕様書 2.2）：
 * - リグ = パーツの並び（parts）＋ 接続の並び（joints）
 * - パーツ：糸も金具もすべてパーツ。ポイント（points）の並びを持つ
 * - ポイント：パーツの始まりからの位置 at（cm）。幅があれば to、形があれば form（環・穴）
 * - 区間：となり合うポイントの間。データには書かず、ポイントの位置から決まる
 * - 接続：2つのパーツのポイントをつなぐ（結束・連結・通し）。パーツではなく、リグの joints に持つ
 *
 * つながっている所：
 * - masters.js：パーツの product・接続の knotStyle が指すマスタ
 * - rigCalc.js：ここで作ったデータの長さ（全長・高さ・間隔）を計算する
 * - これから作る仕掛けエディタ（Issue #3）が、ここの関数でパーツ・接続を足す
 * - これから作る端末保存（Issue #5）が、このデータをそのまま IndexedDB に入れる
 * - rig.test.js が試験する
 */

/**
 * データの形の版（仕様書 2.2 の schemaVersion）。
 * なぜ持つか：あとでデータの形を変えたとき、保存済みの古いデータを
 * 「版1なら、こう読み替える」と見分けられるようにするため。
 *
 * 版1（一直線にパーツを並べる形）から版2（パーツ・ポイント・接続の形）に変えた。
 * 版1のデータは保存の機能（Issue #5）を作る前だったので、どこにも残っていない。
 * そのため版1からの読み替えは作らない。
 */
export const RIG_SCHEMA_VERSION = 2

/**
 * 重ならないID（UUID）を作る。
 *
 * UUID：ランダムに作る36文字のID（例：3f2b...-...）。世界中でほぼ重ならない。
 * crypto.randomUUID はブラウザと Node.js に最初から入っている仕組み。
 * 注意：ブラウザでは https か localhost のページでしか使えない（GitHub Pages は https なので大丈夫）。
 *
 * @returns {string} UUID
 */
export function newId() {
  return crypto.randomUUID()
}

/**
 * 位置・長さとして使える数にする。
 *
 * なぜ必要か：画面の入力欄からは「空」「文字」「マイナス」などが来ることがある。
 * そのまま計算に入れると全長が NaN（数でない値）になったり、図が逆向きに描かれたりする。
 * 仕様書 2.2「ポイント」の決まりどおり、使えない値は 0 にそろえる。
 * （保存はそのままできる。0 にするのは計算のときだけで、警告は rigCalc.js が出す）
 *
 * @param {unknown} value 入力された値（数・文字・空など何でも）
 * @returns {number} 0 以上の数。使えない値は 0
 */
export function toLength(value) {
  // Number('') は 0、Number('abc') は NaN、Number('12.5') は 12.5 になる
  const n = Number(value)
  // Number.isFinite：ふつうの数（NaN や無限大でない）なら true
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/**
 * 位置として「ちゃんとした値」か（警告を出すかどうかの判断用）。
 *
 * 書いていない（undefined）のは「0 として扱う」決まりなので、まちがいではない（仕様書 2.2：
 * 位置を入れなければ 0）。マイナス・数でない値だけを「まちがい」とする。
 *
 * @param {unknown} value ポイントの at や to
 * @returns {boolean} 書いていないか、0 以上の数なら true
 */
export function isValidPosition(value) {
  if (value === undefined || value === null) return true
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * パーツの種類（kind）ごとの、最初のポイントの並び。
 *
 * 種類は画面と最初の値を選ぶためだけに使う。計算では種類を見ない（仕様書 2.1）。
 * なので、ここで決めているのは「足したときに、どんなポイントを最初から作っておくか」だけ。
 *
 * - 糸（line）：始まり start と終わり end。どちらも消せない（仕様書 2.2「画面での入力と表示」）
 * - 金具：環（ring）を必要な数だけ。長さは 0（小さい金具の長さは全長への影響が小さいため）
 * - オモリ：環と下端 tip。下端の位置（オモリの長さ）は入れることをすすめる（底からの高さに効く）
 * - 針：結ぶ所 tie。針もパーツなので、結ぶ所は針のポイントで足りる
 *
 * 【要確認】天秤・三又サルカンのような枝分かれのある金具は、2D座標を入れるまで中の長さを 0 とする
 * （仕様書 2.2）。ポイントの id（a・b・c）の意味は、エディタを作るときに画面で決める。
 */
const KIND_POINTS = {
  line: [{ id: 'start', at: 0 }, { id: 'end', at: 0 }],
  hook: [{ id: 'tie', at: 0 }],
  sinker: [{ id: 'ring', at: 0, form: 'ring' }, { id: 'tip', at: 0 }],
  swivel: [{ id: 'a', at: 0, form: 'ring' }, { id: 'b', at: 0, form: 'ring' }],
  triSwivel: [
    { id: 'a', at: 0, form: 'ring' },
    { id: 'b', at: 0, form: 'ring' },
    { id: 'c', at: 0, form: 'ring' },
  ],
  // スナップ：a はスナップの輪（開く所）、b はもう一方の環
  snap: [{ id: 'a', at: 0, form: 'ring' }, { id: 'b', at: 0, form: 'ring' }],
  tenbin: [
    { id: 'a', at: 0, form: 'ring' },
    { id: 'b', at: 0, form: 'ring' },
    { id: 'c', at: 0, form: 'ring' },
  ],
  // ビーズ・中通しの物：糸を通す穴
  bead: [{ id: 'hole', at: 0, form: 'hole' }],
  other: [{ id: 'p', at: 0 }],
}

/** パーツの種類の一覧（仕様書 2.2「パーツ」の kind）。足しても計算は変わらない */
export const PART_KINDS = Object.keys(KIND_POINTS)

/** パーツの呼び名の一覧（仕様書 2.2「パーツ」の role）。画面に出すだけ */
export const PART_ROLES = ['mikiito', 'edasu', 'harisu', 'sute', 'leader', 'michiito', 'other']

/** 接続の種類の一覧（仕様書 1.3「接続の種類」）：結束・連結・通し */
export const JOINT_TYPES = ['knot', 'link', 'slide']

/** ポイントの形の一覧（仕様書 2.2「ポイント」の form）：環・穴 */
export const POINT_FORMS = ['ring', 'hole']

/**
 * パーツを1つ作る。
 *
 * @param {string} kind パーツの種類（PART_KINDS のどれか）
 * @param {object} [options]
 * @param {number} [options.length] 糸の長さ（cm）。糸（line）のときだけ使い、終わりのポイント end の位置になる
 * @param {string} [options.id] パーツの id（試験などで決めたいとき。ふだんは UUID を自動で振る）
 * @param {string} [options.role] 呼び名（PART_ROLES のどれか）
 * @param {string} [options.product] 製品の id（masters.js）
 * @param {Array<object>} [options.points] ポイントの並び（最初の並びを使わないとき）
 * @param {string} [options.memo] メモ
 * @returns {object} パーツのデータ（仕様書 2.2 の形）
 * @throws {Error} 知らない種類が来たとき（タイプミスに早く気づけるように）
 */
export function createPart(kind, options = {}) {
  const template = KIND_POINTS[kind]
  if (!template) throw new Error(`知らないパーツの種類です：${kind}`)

  const { length, ...rest } = options

  // structuredClone：中の入れ物まで丸ごと複製する仕組み。
  // なぜ：複製しないと、同じ種類のパーツ全部が同じ「最初の並び」を共有してしまい、
  // 1本の糸の長さを変えると他の糸まで変わる、という不具合になるため。
  const points = structuredClone(rest.points ?? template)

  // 糸の長さは「終わりのポイントの位置」として持つ（仕様書 2.2：パーツの長さの欄は別に持たない）
  if (kind === 'line' && length !== undefined) {
    const end = points.find((point) => point.id === 'end')
    if (end) end.at = length
  }

  const part = { id: rest.id ?? newId(), kind, product: rest.product ?? null, points }
  // role と memo は「なくてもよい」項目（仕様書 2.2）。空のときは書かない
  // （書かないほうが、保存したデータを人が読むときに見やすいため）
  if (rest.role) part.role = rest.role
  if (rest.memo) part.memo = rest.memo
  return part
}

/**
 * 接続を1つ作る。
 *
 * @param {string} type 接続の種類（JOINT_TYPES のどれか）：結束 knot／連結 link／通し slide
 * @param {Array<{ part: string, point: string }>} ends つなぐ相手（どのパーツのどのポイントか）。
 *   ふつうは2つ。相手のいない結束（玉留めなど）は1つ
 * @param {object} [options]
 * @param {string} [options.knotStyle] 結び方の id（masters.js）。結束のときだけ使う
 * @param {string} [options.id] 接続の id（ふだんは UUID を自動で振る）
 * @returns {object} 接続のデータ（仕様書 2.2「接続」の形）
 * @throws {Error} 知らない種類・相手がいないとき
 */
export function createJoint(type, ends, options = {}) {
  if (!JOINT_TYPES.includes(type)) throw new Error(`知らない接続の種類です：${type}`)
  if (!Array.isArray(ends) || ends.length === 0) throw new Error('接続の相手（ends）がありません')

  const joint = {
    id: options.id ?? newId(),
    type,
    // 相手を複製して入れる。なぜ：呼んだ側が同じ入れ物を使い回したとき、
    // あとで片方を書き換えると、もう片方の接続まで変わってしまうため
    ends: ends.map((end) => ({ part: end.part, point: end.point })),
  }
  // 結び方は結束のときだけ持つ（仕様書 2.2「接続」）
  if (type === 'knot') joint.knotStyle = options.knotStyle ?? null
  return joint
}

/**
 * 空のリグを1つ作る。
 *
 * @param {object} [overrides] 最初の値から変えたい項目（例：{ name: 'アマダイ胴付き' }）
 * @returns {object} リグのデータ（仕様書 2.2「リグ」の形）
 */
export function createRig(overrides = {}) {
  // 作った日時と変えた日時は、作った瞬間は同じ
  const now = new Date().toISOString()
  return {
    schemaVersion: RIG_SCHEMA_VERSION,
    id: newId(),
    name: '',
    memo: '',
    derivedFrom: null,
    // タックル側の端・全長の起点と終点・底の起点。どれも { part, point } で指す（仕様書 2.2・2.3）
    tackleSide: null,
    lengthStart: null,
    lengthEnd: null,
    bottom: null,
    createdAt: now,
    updatedAt: now,
    parts: [],
    joints: [],
    // 図の上の置き方と描き方。中身は仕掛けエディタ（#3）を作るときに決める
    layout: {},
    ...overrides,
  }
}

/**
 * パーツの長さ（cm）を出す。
 *
 * パーツの長さは、ポイントの位置のいちばん大きい値（at と to のうち大きいほう）。
 * 長さの欄を別に持たないのは、同じ数字を2か所に持たないため（仕様書 2.2「ポイント」）。
 *
 * @param {object} part パーツ
 * @returns {number} 長さ（cm）。ポイントがなければ 0
 */
export function partLength(part) {
  let max = 0
  for (const point of part.points ?? []) {
    max = Math.max(max, toLength(point.at), toLength(point.to))
  }
  return max
}

/**
 * リグの中のパーツを id で探す。
 * @param {object} rig リグ
 * @param {string} partId パーツの id
 * @returns {object | null} パーツ。なければ null
 */
export function findPart(rig, partId) {
  return (rig.parts ?? []).find((part) => part.id === partId) ?? null
}

/**
 * { part, point } で指したポイントが、リグの中に本当にあるか。
 *
 * なぜ要るか：パーツやポイントを消したあと、tackleSide・bottom・接続などが
 * もうないポイントを指したまま残ることがあるため（仕様書 2.3：見つからなければ null と同じ扱い）。
 *
 * @param {object} rig リグ
 * @param {{ part: string, point: string } | null | undefined} ref 指す先
 * @returns {boolean} あれば true
 */
export function pointExists(rig, ref) {
  if (!ref) return false
  const part = findPart(rig, ref.part)
  return Boolean(part && (part.points ?? []).some((point) => point.id === ref.point))
}
