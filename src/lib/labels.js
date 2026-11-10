/**
 * labels.js — 画面に出す名前・文字を作る（パーツの呼び名、長さの書き方など）
 *
 * 種類（kind）・呼び名（role）は、画面のためだけに使う（仕様書 docs/spec.md 2.1）。
 * なので「種類 → 日本語の名前」の対応は、計算のファイルではなくここに置く。
 *
 * つながっている所：
 * - masters.js：製品の名前を引く
 * - rig.js：パーツの長さ（partLength）
 * - components/RigDiagram.jsx：図の横に書く文字に使う
 * - labels.test.js が試験する
 */
import { getProduct } from './masters.js'
import { partLength } from './rig.js'

/** パーツの種類 → 画面の名前（rig.js の PART_KINDS と対応） */
export const KIND_NAMES = {
  line: '糸',
  hook: '針',
  sinker: 'オモリ',
  swivel: 'サルカン',
  triSwivel: '三又サルカン',
  snap: 'スナップ',
  tenbin: '天秤',
  bead: 'ビーズ',
  other: 'その他',
}

/** パーツの呼び名 → 画面の名前（rig.js の PART_ROLES と対応） */
export const ROLE_NAMES = {
  mikiito: '幹糸',
  edasu: '枝ス',
  harisu: 'ハリス',
  sute: '捨て糸',
  leader: 'リーダー',
  michiito: '道糸',
  other: 'その他',
}

/**
 * 長さ（cm）を画面の文字にする。
 * 小数のまちがい（0.1 + 0.2 が 0.30000000000000004 になる、など）が画面に出ないよう、
 * 小数第1位までに丸める。整数ならそのまま。
 *
 * @param {number} cm 長さ（cm）
 * @returns {string} 例：'110cm'、'12.5cm'
 */
export function formatCm(cm) {
  const rounded = Math.round(cm * 10) / 10
  return `${rounded}cm`
}

/**
 * パーツの名前（呼び名があれば呼び名、なければ種類の名前）。
 *
 * @param {object} part パーツ
 * @returns {string} 例：'幹糸'、'オモリ'
 */
export function partTitle(part) {
  return ROLE_NAMES[part.role] ?? KIND_NAMES[part.kind] ?? part.kind
}

/**
 * 製品の短い名前。標準の製品の「（標準）」は、図の上では長いので外す。
 *
 * @param {string | null | undefined} productId 製品の id
 * @returns {string | null} 例：'フロロ 5号'。製品がなければ null
 */
export function productShortName(productId) {
  const product = getProduct(productId)
  if (!product) return null
  return product.name.replace('（標準）', '')
}

/**
 * 図の横に書く、パーツの説明。
 * - 糸：「呼び名 製品 長さ」（例：幹糸 フロロ 5号 110cm）
 * - 金具など：製品の名前（例：サルカン 8号）。製品がなければ種類の名前
 *
 * @param {object} part パーツ
 * @returns {string} 説明の文字
 */
export function partCaption(part) {
  const product = productShortName(part.product)
  if (part.kind === 'line') {
    // 糸の製品名には「糸」が入っていない（例：フロロ 5号）ので、呼び名を前に付ける
    return [partTitle(part), product, formatCm(partLength(part))].filter(Boolean).join(' ')
  }
  return product ?? partTitle(part)
}
