/**
 * RigDiagram.jsx — 仕掛け図（模式図）を SVG で描く React の部品
 *
 * 決まりは仕様書 docs/spec.md の 2.4。
 * どのポイントを図のどこに置くか（座標）は lib/rigLayout.js が決める。ここは「絵を描く」だけ。
 *
 * SVG：線・円・文字などを「形のデータ」で描く画像の書き方。拡大してもぼやけない。
 * HTML と同じように、<line> や <circle> などの部品を並べて書く。
 *
 * 描く順番（あとに描いたものが上に重なる）：
 *   底の線 → 糸 → 金具・針・オモリなどの絵 → 省略の印 → 文字
 *
 * 今は見るだけ。タップして編集するのは #3 から（仕様書 2.6）。
 *
 * つながっている所：
 * - App.jsx から、layoutRig の結果を受け取る
 * - lib/labels.js：図の横に書く文字
 * - lib/masters.js：糸の素材（色を決めるため）
 */
import { getProduct } from '../lib/masters.js'
import { partCaption, formatCm } from '../lib/labels.js'

/**
 * 糸の色（素材ごと）。仕様書 1.3：色を入れなければ、種類と素材ごとに決まった色で描く。
 * 実物の色ではなく、図の上で見分けやすい色を選んでいる。【要確認：触りながら直す】
 */
const LINE_COLORS = {
  fluoro: '#2f7fc1', // フロロ：青
  nylon: '#d9952b', // ナイロン：だいだい
  pe: '#2e9b5a', // PE：緑
  ester: '#8e5bb5', // エステル：紫
}
/** 素材が分からない糸の色 */
const LINE_COLOR_UNKNOWN = '#6b7c86'
/** 金具・針の色 */
const METAL = '#4a5560'

/** 文字の大きさ（SVG の単位） */
const CAPTION_SIZE = 11
const SMALL_SIZE = 10

/**
 * 文字の幅のおおよそ。SVG は描くまで文字の幅が分からないので、
 * 図の大きさ（はみ出さないための余白）を決めるために見積もる。
 * 日本語の文字は文字の大きさとほぼ同じ幅、英数字はその 6 割くらい。
 *
 * @param {string} text 文字
 * @param {number} size 文字の大きさ
 * @returns {number} 幅のおおよそ
 */
function estimateWidth(text, size) {
  let width = 0
  for (const ch of text) width += ch.charCodeAt(0) > 0xff ? size : size * 0.6
  return width
}

/**
 * 糸の色を、製品の素材から決める。
 * @param {object} part パーツ
 * @returns {string} 色
 */
function lineColor(part) {
  const material = getProduct(part.product)?.material
  return LINE_COLORS[material] ?? LINE_COLOR_UNKNOWN
}

/**
 * 図の横に書く文字を、すべて集める。
 * 先に集めるのは、文字の幅も含めて図の大きさ（viewBox）を決めるため。
 *
 * 置き方の決まり（重なりにくいように、場所を分けている）：
 * - 縦の糸・金具の説明：線の左
 * - 縦の糸の区間ごとの長さ：線の右
 * - 横の糸の説明：線の上
 * - 針・ビーズなど1点のパーツ：その右
 * - 分岐点の底からの高さ：縦の線の左（仕様書 2.4）
 *
 * @param {ReturnType<import('../lib/rigLayout.js').layoutRig>} layout 置き方
 * @returns {Array<{ key: string, x: number, y: number, text: string, anchor: string, size: number, tone: string }>}
 *   - anchor：文字をどちら側にそろえるか（start＝x から右へ、end＝x で終わる、middle＝x が中央）
 *   - tone：色の種類（caption＝ふつう、muted＝うすい、sea＝目立たせる）
 */
function collectLabels(layout) {
  const labels = []

  for (const { part, points } of layout.parts) {
    const first = points[0]
    const last = points[points.length - 1]
    const caption = partCaption(part)
    const vertical = first.x === last.x
    const midX = (first.x + last.x) / 2
    const midY = (first.y + last.y) / 2

    if (points.length === 1) {
      // 針・ビーズなど：右に書く。針は下に絵が垂れるので、少し下げる
      const dy = part.kind === 'hook' ? 12 : 4
      labels.push({ key: `${part.id}-c`, x: first.x + 10, y: first.y + dy, text: caption, anchor: 'start', size: CAPTION_SIZE, tone: 'muted' })
      continue
    }

    const tone = part.kind === 'line' ? 'caption' : 'muted'
    if (vertical) {
      labels.push({ key: `${part.id}-c`, x: midX - 10, y: midY + 4, text: caption, anchor: 'end', size: CAPTION_SIZE, tone })
    } else {
      // 横の糸：右向きなら左端から右へ、左向きなら右端から左へ書く（枝スの付け根側にそろえる）
      const toRight = last.x > first.x
      labels.push({
        key: `${part.id}-c`,
        x: first.x + (toRight ? 6 : -6),
        y: first.y - 6,
        text: caption,
        anchor: toRight ? 'start' : 'end',
        size: CAPTION_SIZE,
        tone,
      })
    }

    // 途中にポイントがある糸は、区間ごとの長さも書く（仕様書 2.4）。
    // 「エダスとエダスの間が何cm」と考えることが多いため（仕様書 2.2「画面での入力と表示」）
    if (part.kind === 'line' && points.length >= 3) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]
        const b = points[i]
        const text = formatCm(b.at - a.at)
        labels.push(
          vertical
            ? { key: `${part.id}-s${i}`, x: a.x + 6, y: (a.y + b.y) / 2 + 4, text, anchor: 'start', size: SMALL_SIZE, tone: 'muted' }
            : { key: `${part.id}-s${i}`, x: (a.x + b.x) / 2, y: a.y + 14, text, anchor: 'middle', size: SMALL_SIZE, tone: 'muted' },
        )
      }
    }
  }

  for (const [i, mark] of layout.branchMarks.entries()) {
    labels.push({ key: `bm${i}`, x: mark.x - 10, y: mark.y + 4, text: `底から ${formatCm(mark.height)}`, anchor: 'end', size: SMALL_SIZE, tone: 'sea' })
  }

  return labels
}

/**
 * 図の大きさ（viewBox）を決める。ポイントの位置・絵・文字が全部入るようにする。
 *
 * viewBox：SVG の「どの範囲を見せるか」の指定。左上の x・y と、幅・高さ。
 *
 * @param {ReturnType<import('../lib/rigLayout.js').layoutRig>} layout 置き方
 * @param {ReturnType<typeof collectLabels>} labels 文字
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function computeBox(layout, labels) {
  // 絵（オモリ・針など）は、ポイントから最大でこのくらいはみ出す
  const ICON = 16
  let { minX, maxX, minY, maxY } = layout.bounds
  minX -= ICON
  maxX += ICON
  minY -= ICON
  maxY += ICON + 10 // 針は下に垂れるので、下は少し多めに
  for (const label of labels) {
    const w = estimateWidth(label.text, label.size)
    const left = label.anchor === 'end' ? label.x - w : label.anchor === 'middle' ? label.x - w / 2 : label.x
    minX = Math.min(minX, left)
    maxX = Math.max(maxX, left + w)
    minY = Math.min(minY, label.y - label.size)
    maxY = Math.max(maxY, label.y + 4)
  }
  const pad = 8
  return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
}

/**
 * 2つのポイントの間に描く金具の絵の「置き場所」を作る。
 * 絵は「始まりから下向き（+y）に長さ L」の形で描き、transform で回して向きを合わせる。
 * こうすると、縦でも横でも同じ絵の書き方で済む。
 *
 * transform：SVG の部品を動かす・回す指定。translate(x, y) で移動、rotate(角度) で回す。
 *
 * @param {{ x: number, y: number }} a 始まり
 * @param {{ x: number, y: number }} b 終わり
 * @returns {{ transform: string, length: number }}
 */
function segmentFrame(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  // Math.atan2 は「右向き」を 0 度とした角度（ラジアン）を返す。
  // 絵は「下向き」を基本に描くので、90 度（下向き）を引いて合わせる
  const angle = length === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI - 90
  return { transform: `translate(${a.x} ${a.y}) rotate(${angle})`, length }
}

/**
 * 糸以外のパーツの絵を描く。どの絵にするかは種類（kind）で決める（画面のためだけ。仕様書 2.4）。
 *
 * @param {{ part: object, points: Array<{ x: number, y: number }> }} item パーツと、そのポイントの位置
 * @returns {JSX.Element} 絵
 */
function PartIcon({ item }) {
  const { part, points } = item
  const first = points[0]
  const last = points[points.length - 1]

  switch (part.kind) {
    case 'swivel': {
      // サルカン：両端に環、まん中に胴
      const { transform, length: L } = segmentFrame(first, last)
      return (
        <g transform={transform} stroke={METAL} strokeWidth="1.6" fill="none">
          <circle cx="0" cy="3.5" r="3.5" />
          <circle cx="0" cy={L - 3.5} r="3.5" />
          {L > 16 && <rect x="-3" y="7" width="6" height={L - 14} rx="2" fill={METAL} />}
        </g>
      )
    }
    case 'snap': {
      // スナップ：細長い輪と、もう一方の環
      const { transform, length: L } = segmentFrame(first, last)
      return (
        <g transform={transform} stroke={METAL} strokeWidth="1.6" fill="none">
          <rect x="-3.5" y="0" width="7" height={Math.max(8, L - 7)} rx="3.5" />
          <circle cx="0" cy={L - 3.5} r="3.5" />
        </g>
      )
    }
    case 'sinker': {
      // オモリ：環（始まり）と、しずく形の胴（環から下端まで）
      const { transform, length: L } = segmentFrame(first, last)
      const bodyTop = 6
      return (
        <g transform={transform}>
          <circle cx="0" cy="3" r="3" stroke={METAL} strokeWidth="1.6" fill="none" />
          <ellipse cx="0" cy={(bodyTop + L) / 2} rx="7" ry={Math.max(4, (L - bodyTop) / 2)} fill="#5d6b75" />
        </g>
      )
    }
    case 'hook': {
      // 針：結ぶ所から下へ軸、先で曲がって上を向く（J の形）。カエシ（針先の返し）も小さく描く
      return (
        <path
          d={`M${first.x} ${first.y} v16 a6 6 0 0 1 -12 0 v-5 l3 3`}
          stroke={METAL}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      )
    }
    case 'bead':
      return <circle cx={first.x} cy={first.y} r="4.5" fill="#e0603a" />
    default: {
      // 三又サルカン・天秤・その他：ポイントの重心（まん中）から各ポイントへ線を引き、ポイントに環を描く。
      // 形の決まった絵は、使ってみて要るものから足す【要確認】
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length
      return (
        <g stroke={METAL} strokeWidth="1.6" fill="none">
          {points.map((p, i) => (
            <line key={`l${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} />
          ))}
          {points.map((p, i) => (
            <circle key={`c${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" />
          ))}
        </g>
      )
    }
  }
}

/** 文字の色の種類 → 色 */
const TONE_COLORS = { caption: '#1b2a33', muted: '#6b7c86', sea: '#0b3d5c' }

/**
 * 仕掛け図。
 *
 * @param {object} props
 * @param {ReturnType<import('../lib/rigLayout.js').layoutRig>} props.layout 置き方（lib/rigLayout.js の layoutRig の結果）
 * @returns {JSX.Element} 図。描けないときは、その理由の文
 */
export default function RigDiagram({ layout }) {
  if (layout.parts.length === 0) {
    return <p className="diagram-empty">図を描けません（タックル側の端が選ばれていません）</p>
  }

  const labels = collectLabels(layout)
  const box = computeBox(layout, labels)
  const lines = layout.parts.filter((item) => item.part.kind === 'line')
  const others = layout.parts.filter((item) => item.part.kind !== 'line')

  return (
    // 幅は図の大きさそのまま（縮めない）。画面より広いときは、外側の枠で横に動かして見る。
    // 縮めると文字が小さくなりすぎ、#3 でタップしにくくなるため。
    <svg
      className="rig-diagram"
      width={box.width}
      height={box.height}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      role="img"
      aria-label="仕掛け図"
    >
      {/* 底の線：底の起点の高さに、横いっぱいの破線 */}
      {layout.bottomY !== null && (
        <g>
          <line
            x1={box.x}
            x2={box.x + box.width}
            y1={layout.bottomY}
            y2={layout.bottomY}
            stroke="#a08a6a"
            strokeWidth="1"
            strokeDasharray="5 4"
          />
          <text x={box.x + box.width - 4} y={layout.bottomY - 4} fontSize={SMALL_SIZE} textAnchor="end" fill="#a08a6a">
            底
          </text>
        </g>
      )}

      {/* 糸：ポイントを位置の順に結ぶ線 */}
      {lines.map(({ part, points }) => (
        <polyline
          key={part.id}
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          stroke={lineColor(part)}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* 金具・針・オモリなど */}
      {others.map((item) => (
        <PartIcon key={item.part.id} item={item} />
      ))}

      {/* 省略の印「≈」：長い糸の途中。白い四角で線を消してから印を書く */}
      {layout.cuts.map((cut, i) => (
        <g key={`cut${i}`}>
          <rect x={cut.x - 8} y={cut.y - 6} width="16" height="12" fill="#fff" />
          <text x={cut.x} y={cut.y + 5} fontSize="14" textAnchor="middle" fill={TONE_COLORS.muted}>
            ≈
          </text>
        </g>
      ))}

      {/* 文字 */}
      {labels.map((label) => (
        <text
          key={label.key}
          x={label.x}
          y={label.y}
          fontSize={label.size}
          textAnchor={label.anchor}
          fill={TONE_COLORS[label.tone]}
        >
          {label.text}
        </text>
      ))}
    </svg>
  )
}
