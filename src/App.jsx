/**
 * App.jsx — 画面全体
 *
 * 今は、仕掛け図（#4）を確かめるために、見本のリグ（アマダイ胴付き 2本針）を図にして出している。
 * エディタ（#3）ができたら、見本の代わりに、自分で組んだリグを出す。
 *
 * 画面の配置（仕様書 docs/spec.md 2.6）：
 *   上：リグの名前・全長・警告の数 → 中：仕掛け図 → 下：版とビルド日時
 *
 * つながっている所：
 * - main.jsx から呼ばれる
 * - lib/samples.js：見本のリグ
 * - lib/rigLayout.js：図の置き方（長さの計算 measureRig の結果も中に入っている）
 * - components/RigDiagram.jsx：図を描く
 * - lib/buildInfo.js：版とビルド日時
 */
import { useMemo } from 'react'
import { getBuildInfo } from './lib/buildInfo.js'
import { sampleAmadaiRig } from './lib/samples.js'
import { layoutRig } from './lib/rigLayout.js'
import { formatCm } from './lib/labels.js'
import RigDiagram from './components/RigDiagram.jsx'

/**
 * 画面全体を返す React の部品（コンポーネント）。
 * コンポーネント：画面の一部分を、関数として部品化したもの。
 * 戻り値の JSX が、そのまま画面になる。
 *
 * @returns {JSX.Element} 画面全体
 */
export default function App() {
  // 画面を描くたびに呼んでも、値はビルドのときに決まった定数なので軽い
  const { version, buildTimeText } = getBuildInfo()

  // useMemo：前と同じ材料なら、前の計算結果を使い回す React の仕組み。
  // 見本は変わらないので、最初の1回だけ作って計算する（[] は「材料なし＝1回だけ」の意味）
  const rig = useMemo(() => sampleAmadaiRig(), [])
  const layout = useMemo(() => layoutRig(rig), [rig])
  const { totalLength, warnings } = layout.measure

  return (
    <main className="app">
      <header className="rig-header">
        <h1>tackle-lab</h1>
        <p className="rig-name">{rig.name}</p>
        <p className="rig-summary">
          全長 <strong>{totalLength === null ? '—' : formatCm(totalLength)}</strong>
          {/* 警告があるときだけ数を出す。中身を出すのはエディタ（#3）から */}
          {warnings.length > 0 && <span className="rig-warning">　警告 {warnings.length}件</span>}
        </p>
      </header>

      {/* 図が画面より広いときは、この枠の中で横に動かして見る */}
      <div className="diagram-scroll">
        <RigDiagram layout={layout} />
      </div>

      <p className="note">見本の仕掛けです。自分で組むエディタは、次の版から作ります。</p>

      {/* 版とビルド日時。スマホで「新しい版が届いたか」を見分ける目印 */}
      <footer className="build-info">
        版 {version} ／ ビルド {buildTimeText}
      </footer>
    </main>
  )
}
