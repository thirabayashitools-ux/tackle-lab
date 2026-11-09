/**
 * App.jsx — 画面全体（いまは仮の画面）
 *
 * Issue #1 の時点では、公開の流れが通ったかを確かめるための仮の画面。
 * 仕掛けエディタ（Issue #3）・仕掛け図（Issue #4）ができたら、ここに組み込む。
 *
 * つながっている所：
 * - main.jsx から呼ばれる
 * - lib/buildInfo.js から版とビルド日時をもらう
 */
import { getBuildInfo } from './lib/buildInfo.js'

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

  return (
    <main className="app">
      <h1>tackle-lab</h1>
      <p>釣りの仕掛けを設計するアプリ（準備中）</p>

      {/* 版とビルド日時。スマホで「新しい版が届いたか」を見分ける目印 */}
      <footer className="build-info">
        版 {version} ／ ビルド {buildTimeText}
      </footer>
    </main>
  )
}
