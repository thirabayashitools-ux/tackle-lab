/**
 * masters.js — アプリに最初から入れておく「標準のマスタ」（素材・製品・結び方）
 *
 * マスタ：パーツや接続の性質（数字）の元になる表。仕様書 docs/spec.md の 2.2「マスタ」。
 * リグ（仕掛け）には id だけを書き、数字はここから引く（仕様書 2.1「性質の数字は、マスタから引く」）。
 *
 * 3つの表：
 * - 素材 MATERIALS：フロロ・ナイロン・PE・真鍮・鉛など。物性（素材で決まる性質）を持つ
 * - 製品 PRODUCTS：パーツが指す物（例：フロロ 3号（標準））。スペックを持ち、素材を指す
 * - 結び方 KNOT_STYLES：クリンチノット・エダス結びなど。接続（結束）が指す
 *
 * Phase 1 で持つ項目は最低限だけ（仕様書 2.1「項目は、それを使う計算か画面ができるときに足す」）。
 * - 素材：id・名前
 * - 製品：id・名前・合う種類（kinds）・素材・号数かサイズ
 * - 結び方：id・名前
 * 伸び率・破断強度・結束強度（%）などは、強度の計算（Phase 2・3章）を作るときに足す。
 *
 * 「標準の製品」：メーカーの製品ではなく「一般的なフロロ 3号」のような物。
 * Phase 1 では製品を選ばず「フロロ 3号」とだけ入れることが多いので、それを製品の1つとして持つ。
 * あとでメーカーの製品に切り替えるときも、パーツが指す id を変えるだけで済む。
 *
 * つながっている所：
 * - rig.js のパーツ（product）と接続（knotStyle）が、ここの id を指す
 * - これから作る仕掛けエディタ（Issue #3）が、製品・結び方の選択肢としてここを読む
 * - 共有DB（Phase 2・4章）で増やす製品・実測値は、ここと同じ形で足す予定
 * - masters.test.js が試験する
 */

/**
 * 1号あたりのオモリの重さ（g）。
 * 釣りのオモリの「号」は、もともと重さの単位「匁（もんめ）」と同じで、1号＝3.75g。
 * 仕様書 2.2「マスタ」：オモリの重さは号数から出す。
 */
export const SINKER_GRAMS_PER_GOU = 3.75

/**
 * オモリの号数から重さ（g）を出す。
 *
 * @param {number} gou オモリの号数（例：80）
 * @returns {number | null} 重さ（g）。号数が数でない・マイナスなら null（分からない）
 *
 * なぜ 0 でなく null にするか：重さ 0 のオモリは「軽い」と誤解されるが、
 * 号数が分からないのは「分からない」なので、計算する側で区別できるようにするため。
 */
export function sinkerWeightGrams(gou) {
  if (typeof gou !== 'number' || !Number.isFinite(gou) || gou < 0) return null
  return gou * SINKER_GRAMS_PER_GOU
}

// ---------------------------------------------------------------------------
// 素材
// ---------------------------------------------------------------------------

/**
 * 素材の一覧。
 * Object.freeze：中身を書き換えられないようにする仕組み。
 * なぜ：マスタはアプリ全体で1つを共有するので、どこかで間違って書き換えると
 * 全部の仕掛けの計算が狂う。書き換えようとしたらエラーで気づけるようにする。
 *
 * @type {ReadonlyArray<{ id: string, name: string }>}
 */
export const MATERIALS = deepFreeze([
  { id: 'fluoro', name: 'フロロカーボン' },
  { id: 'nylon', name: 'ナイロン' },
  { id: 'pe', name: 'PE' },
  // エステル：伸びが少ない糸。アジング・メバリングなどで使う
  { id: 'ester', name: 'エステル' },
  { id: 'brass', name: '真鍮' },
  { id: 'stainless', name: 'ステンレス' },
  // 針の素材。種類（ステンレス・炭素鋼など）を分けるのは強度の計算のとき
  { id: 'steel', name: '鋼（はがね）' },
  { id: 'lead', name: '鉛' },
  { id: 'tungsten', name: 'タングステン' },
  { id: 'plastic', name: 'プラスチック' },
  // 分からないとき・上のどれにも当たらないとき
  { id: 'other', name: 'その他' },
])

// ---------------------------------------------------------------------------
// 製品（標準の製品）
// ---------------------------------------------------------------------------

/**
 * 糸の標準の号数の並び。
 * 【要確認】どの号数を入れておくか（仕様書 2.2「マスタ」）。
 * 船釣り・堤防でよく使う範囲を仮に並べた。足りなければ足す。
 */
const LINE_GOU = {
  fluoro: [0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 30],
  nylon: [0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 30],
  pe: [0.4, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10],
  ester: [0.2, 0.3, 0.4, 0.5, 0.6],
}

/** 糸の素材の、製品名での呼び方（「フロロカーボン」は長いので「フロロ」） */
const LINE_SHORT_NAME = { fluoro: 'フロロ', nylon: 'ナイロン', pe: 'PE', ester: 'エステル' }

/** オモリの標準の号数の並び【要確認】 */
const SINKER_GOU = [0.5, 1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200]

/**
 * サルカン（より戻し）の標準のサイズ【要確認】。
 * サルカンのサイズは「号」で、数字が大きいほど小さい（メーカーで多少違う）。
 */
const SWIVEL_SIZES = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14]

/** スナップの標準のサイズ【要確認】。こちらは数字が大きいほど大きい */
const SNAP_SIZES = [0, 1, 2, 3, 4, 5]

/**
 * 針の標準の種類と号数【要確認】。
 * 針は形（種類）ごとに号数の大きさが違うので、種類 × 号数で1つの製品にする。
 */
const HOOK_TYPES = [
  { key: 'amadai', name: 'アマダイ針', gou: [9, 10, 11, 12, 13, 14, 15] },
  { key: 'maruseigo', name: '丸セイゴ', gou: [8, 10, 12, 14, 16, 18] },
  { key: 'chinu', name: 'チヌ針', gou: [1, 2, 3, 4, 5, 6] },
  { key: 'iseama', name: '伊勢尼', gou: [6, 8, 10, 12, 14] },
  { key: 'mutsu', name: 'ムツ針', gou: [12, 14, 16, 18, 20] },
]

/**
 * 号数を id に使う文字にする。
 * 1.5号 → "1.5"。小数のまま入れるのは、"1_5" などに直すと読みにくいため（仕様書 2.2：id は読める名前）。
 *
 * @param {number} n 号数・サイズ
 * @returns {string} id に使う文字
 */
function numText(n) {
  return String(n)
}

/**
 * 標準の製品の一覧を作る。
 * 手で何百行も書くと書きまちがいが出るので、上の号数の並びから組み立てる。
 *
 * 製品の項目（Phase 1）：
 * - id：読める固定の名前（例：std-fluoro-3）【要確認】
 * - name：画面に出す名前（例：フロロ 3号（標準））
 * - kinds：その製品を選べるパーツの種類（rig.js の PART_KINDS）。選択肢を絞るのに使う
 * - material：素材の id
 * - gou：号数（糸・オモリ・針）。サイズで呼ぶ物は null
 * - size：サイズ（サルカン・スナップなど）。号数で呼ぶ物は null
 *
 * @returns {Array<object>} 製品の一覧
 */
function buildStandardProducts() {
  const list = []

  // 糸：素材 × 号数
  for (const [material, gous] of Object.entries(LINE_GOU)) {
    for (const gou of gous) {
      list.push({
        id: `std-${material}-${numText(gou)}`,
        name: `${LINE_SHORT_NAME[material]} ${gou}号（標準）`,
        kinds: ['line'],
        material,
        gou,
        size: null,
      })
    }
  }

  // オモリ：号数ごと。重さは sinkerWeightGrams(gou) で出すので、ここには持たない
  // （同じ数字を2か所に持たないため。仕様書 2.1）
  for (const gou of SINKER_GOU) {
    list.push({
      id: `std-sinker-${numText(gou)}`,
      name: `オモリ ${gou}号（標準）`,
      kinds: ['sinker'],
      material: 'lead',
      gou,
      size: null,
    })
  }

  // 針：種類 × 号数
  for (const type of HOOK_TYPES) {
    for (const gou of type.gou) {
      list.push({
        id: `std-hook-${type.key}-${numText(gou)}`,
        name: `${type.name} ${gou}号（標準）`,
        kinds: ['hook'],
        material: 'steel',
        gou,
        size: null,
      })
    }
  }

  // サルカン・三又サルカン：サイズごと
  for (const size of SWIVEL_SIZES) {
    list.push({
      id: `std-swivel-${numText(size)}`,
      name: `サルカン ${size}号（標準）`,
      kinds: ['swivel'],
      material: 'brass',
      gou: null,
      size: `${size}号`,
    })
    list.push({
      id: `std-triswivel-${numText(size)}`,
      name: `三又サルカン ${size}号（標準）`,
      kinds: ['triSwivel'],
      material: 'brass',
      gou: null,
      size: `${size}号`,
    })
  }

  // スナップ：サイズごと
  for (const size of SNAP_SIZES) {
    list.push({
      id: `std-snap-${numText(size)}`,
      name: `スナップ ${size}号（標準）`,
      kinds: ['snap'],
      material: 'stainless',
      gou: null,
      size: `${size}号`,
    })
  }

  // サイズを分けない物（大きさは、強度などを使うときに分ける）
  list.push(
    {
      id: 'std-tenbin',
      name: '天秤（標準）',
      kinds: ['tenbin'],
      material: 'stainless',
      gou: null,
      size: null,
    },
    {
      id: 'std-bead',
      name: 'ビーズ（標準）',
      kinds: ['bead'],
      material: 'plastic',
      gou: null,
      size: null,
    },
  )

  return list
}

/**
 * 製品の一覧（標準の製品だけ。共有DBの製品は Phase 2 から足す）
 * @type {ReadonlyArray<object>}
 */
export const PRODUCTS = deepFreeze(buildStandardProducts())

// ---------------------------------------------------------------------------
// 結び方
// ---------------------------------------------------------------------------

/**
 * 結び方の一覧。
 * 素材ごとの強さの下がり方（%）は、強度の計算（3章）を作るときに足す。
 *
 * forms：その結び方がよく使われる場面の目安。画面で選択肢を並べる順番などに使う予定で、
 * 計算には使わない（仕様書 2.1「計算は、区間とポイントの性質だけを見る」）。
 * - 'tie'：糸を金具（環）や針に結ぶ
 * - 'join'：糸と糸を結ぶ
 * - 'branch'：糸の途中から別の糸を出す
 * - 'end'：相手のいない結び目（玉留め・ループを作る結び目）
 *
 * @type {ReadonlyArray<{ id: string, name: string, forms: string[] }>}
 */
export const KNOT_STYLES = deepFreeze([
  { id: 'clinch', name: 'クリンチノット', forms: ['tie'] },
  { id: 'improvedClinch', name: 'インプルーブドクリンチノット', forms: ['tie'] },
  { id: 'palomar', name: 'パロマーノット', forms: ['tie'] },
  { id: 'uni', name: 'ユニノット', forms: ['tie'] },
  { id: 'sotogake', name: '外掛け結び', forms: ['tie'] },
  { id: 'uchigake', name: '内掛け結び', forms: ['tie'] },
  { id: 'densha', name: '電車結び', forms: ['join'] },
  { id: 'fg', name: 'FGノット', forms: ['join'] },
  { id: 'pr', name: 'PRノット', forms: ['join'] },
  { id: 'surgeons', name: 'サージャンズノット', forms: ['join'] },
  { id: 'edasu', name: 'エダス結び', forms: ['branch'] },
  { id: 'eightLoop', name: '8の字結び（チチワ）', forms: ['end'] },
  { id: 'tamadome', name: '玉留め', forms: ['end'] },
])

// ---------------------------------------------------------------------------
// 引くための関数
// ---------------------------------------------------------------------------

/**
 * id で引くための索引（Map）を作る。
 * Map：「キー → 値」の対応表。配列を毎回頭から探すより速く引ける。
 *
 * @param {ReadonlyArray<{ id: string }>} list 一覧
 * @returns {Map<string, object>} id → 中身
 */
function indexById(list) {
  return new Map(list.map((item) => [item.id, item]))
}

const MATERIAL_INDEX = indexById(MATERIALS)
const PRODUCT_INDEX = indexById(PRODUCTS)
const KNOT_STYLE_INDEX = indexById(KNOT_STYLES)

/**
 * 素材を id で引く。
 * @param {string | null | undefined} id 素材の id
 * @returns {object | null} 素材。見つからなければ null
 */
export function getMaterial(id) {
  return MATERIAL_INDEX.get(id) ?? null
}

/**
 * 製品を id で引く。
 * @param {string | null | undefined} id 製品の id（パーツの product）
 * @returns {object | null} 製品。見つからなければ null（仕様書 2.2：分からないとして扱う）
 */
export function getProduct(id) {
  return PRODUCT_INDEX.get(id) ?? null
}

/**
 * 結び方を id で引く。
 * @param {string | null | undefined} id 結び方の id（接続の knotStyle）
 * @returns {object | null} 結び方。見つからなければ null
 */
export function getKnotStyle(id) {
  return KNOT_STYLE_INDEX.get(id) ?? null
}

/**
 * パーツの種類に合う製品だけを出す（エディタの選択肢用）。
 * @param {string} kind パーツの種類（例：'line'）
 * @returns {object[]} 合う製品の一覧
 */
export function productsForKind(kind) {
  return PRODUCTS.filter((product) => product.kinds.includes(kind))
}

/**
 * 中の入れ物まで丸ごと書き換えられないようにする。
 * Object.freeze は一番外側しか止めないので、中の配列・オブジェクトにも順にかける。
 *
 * @template T
 * @param {T} value 止めたい値
 * @returns {T} 同じ値（止めたもの）
 */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}
