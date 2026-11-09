/**
 * buildInfo.js — 版とビルド日時を、画面に出せる形にする
 *
 * なぜあるか：
 *   GitHub Pages に新しい版が公開されたかどうかを、スマホの画面で見分けるため。
 *   ブラウザが古い版を覚えて（キャッシュして）いると、push しても画面が変わらないことがある。
 *   画面のビルド日時が最新の push と合っていれば、新しい版が届いている。
 *
 * つながっている所：
 * - vite.config.js の define が、__APP_VERSION__ と __BUILD_TIME__ を埋め込む
 * - App.jsx が getBuildInfo() を呼んで画面に出す
 * - buildInfo.test.js が formatBuildTime() を試験する
 */

/**
 * ISO 形式の日時（例：2026-11-09T03:50:00.000Z）を、日本時間の読みやすい文字にする。
 *
 * なぜ日本時間に直すか：
 *   ビルドは GitHub のサーバー（世界標準時 UTC）で動くので、そのままだと9時間ずれて見える。
 *
 * @param {string} iso ISO 形式の日時の文字列
 * @returns {string} 例：「2026-11-09 12:50」。読めない値のときは「不明」
 */
export function formatBuildTime(iso) {
  const date = new Date(iso)

  // 日付として読めない文字（空文字など）が来たときは NaN（数でない値）になる。
  // そのまま整形すると「Invalid Date」と出て分かりにくいので、「不明」にする。
  if (Number.isNaN(date.getTime())) return '不明'

  // Intl.DateTimeFormat：国や地域に合わせて日時を整形する、ブラウザ標準の仕組み。
  // formatToParts で「年」「月」…と部品ごとに受け取り、自分で並べる。
  // なぜ部品ごとか：toLocaleString だと環境によって「2026/11/9 12:50:00」など形が変わり、
  // 試験で結果が安定しないため。
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // 0〜23時の表記にする（午前/午後を付けない）
  }).formatToParts(date)

  // parts は [{type:'year', value:'2026'}, {type:'literal', value:'/'}, ...] の形。
  // type ごとに値を取り出せるよう、{ year:'2026', month:'11', ... } に詰め替える。
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

/**
 * 画面に出す版とビルド日時をまとめて返す。
 *
 * 注意：__APP_VERSION__ と __BUILD_TIME__ は、ビルドのときに Vite が値に置き換える名前。
 * 試験（Vitest）でも vite.config.js の設定が使われるので、置き換えられる。
 *
 * @returns {{ version: string, buildTimeText: string }} 版と、日本時間のビルド日時
 */
export function getBuildInfo() {
  return {
    version: __APP_VERSION__,
    buildTimeText: formatBuildTime(__BUILD_TIME__),
  }
}
