/**
 * rig.js — 仕掛けとパーツのデータを作る・整える
 *
 * rig（リグ）：英語で「仕掛け」のこと。このアプリでは仕掛け1つ分のデータを rig と呼ぶ。
 *
 * データの形は仕様書 docs/spec.md の 2.1・2.2 に書いてある。
 * ここを変えるときは、先に仕様書を直してから（CLAUDE.md 6章）。
 *
 * つながっている所：
 * - rigCalc.js が、ここで作ったデータの長さを計算する
 * - これから作る仕掛けエディタ（Issue #3）が、ここの関数でパーツを足す
 * - これから作る端末保存（Issue #5）が、このデータをそのまま IndexedDB に入れる
 */

/**
 * データの形の版（仕様書 2.1 の schemaVersion）。
 * なぜ持つか：あとでデータの形を変えたとき、保存済みの古いデータを
 * 「版1なら、こう読み替える」と見分けられるようにするため。
 */
export const RIG_SCHEMA_VERSION = 1

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
 * 長さとして使える数にする。
 *
 * なぜ必要か：画面の入力欄からは「空」「文字」「マイナス」などが来ることがある。
 * そのまま計算に入れると全長が NaN（数でない値）になったり、図が逆向きに描かれたりする。
 * 仕様書 2.2 の決まりどおり、使えない値は 0 にそろえる。
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
 * 種類ごとの、パーツの初期値。
 * 共通の項目（id・kind・length など）は createPart の中で足す。
 *
 * なぜ表にしているか：種類が増えたとき、ここに1行足せば済むようにするため。
 */
const PART_DEFAULTS = {
  line: { role: 'mikiito', material: 'fluoro', gou: null },
  connector: { subtype: 'swivel', size: '' },
  // 枝スは「糸」と「針」を1つのパーツとして持つ（仕様書 2.2）
  branch: {
    line: { material: 'fluoro', gou: null, length: 0 },
    hook: { name: '', size: '' },
  },
  hook: { name: '', size: '' },
  sinker: { weight: null },
  other: { name: '' },
}

/** パーツの種類の一覧（仕様書 2.2 の kind） */
export const PART_KINDS = Object.keys(PART_DEFAULTS)

/**
 * パーツを1つ作る。
 *
 * @param {string} kind パーツの種類（PART_KINDS のどれか）
 * @param {object} [overrides] 初期値から変えたい項目（例：{ length: 50, gou: 4 }）
 * @returns {object} パーツのデータ（仕様書 2.2 の形）
 * @throws {Error} 知らない種類が来たとき（タイプミスに早く気づけるように）
 */
export function createPart(kind, overrides = {}) {
  const defaults = PART_DEFAULTS[kind]
  if (!defaults) throw new Error(`知らないパーツの種類です：${kind}`)

  // structuredClone：中の入れ物（branch.line など）まで丸ごと複製する仕組み。
  // なぜ：複製しないと、全部の枝スが同じ「初期値の入れ物」を共有してしまい、
  // 1本の枝スの長さを変えると他の枝スまで変わる、という不具合になるため。
  const part = {
    id: newId(),
    kind,
    length: 0,
    color: '',
    memo: '',
    productId: null,
    ...structuredClone(defaults),
    ...overrides,
  }
  // 枝スは軸の上で場所を取らない（仕様書 2.2）。overrides で長さが来ても 0 に戻す。
  // 枝ス自体の長さは part.line.length に入れる。
  if (kind === 'branch') part.length = 0
  return part
}

/**
 * 空の仕掛けを1つ作る。
 *
 * @param {object} [overrides] 初期値から変えたい項目（例：{ name: 'アマダイ胴付き', type: 'dozuki' }）
 * @returns {object} 仕掛けのデータ（仕様書 2.1 の形）
 */
export function createRig(overrides = {}) {
  // 作った日時と変えた日時は、作った瞬間は同じ
  const now = new Date().toISOString()
  return {
    schemaVersion: RIG_SCHEMA_VERSION,
    id: newId(),
    name: '',
    type: 'dozuki',
    memo: '',
    derivedFrom: null,
    createdAt: now,
    updatedAt: now,
    parts: [],
    ...overrides,
  }
}
