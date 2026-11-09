/**
 * vite.config.js — Vite（ビルドの道具）の設定
 *
 * Vite は、src/ に書いた React のコードを、ブラウザがそのまま読めるファイル
 * （dist/ フォルダ）に変換する道具。`npm run build` で動く。
 *
 * このファイルとつながっている所：
 * - package.json の scripts（dev / build / test）から呼ばれる
 * - src/lib/buildInfo.js が、ここで埋め込む __APP_VERSION__ / __BUILD_TIME__ を読む
 * - .github/workflows/deploy.yml が、ビルドと試験を GitHub 上で回す
 */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// package.json の version を読む。
// なぜ：画面に版を出して、スマホで「新しい版が届いたか」を見分けられるようにするため。
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  plugins: [react()],

  // base：公開したときの「住所」の先頭部分。
  // なぜ：GitHub Pages では https://<ユーザー名>.github.io/tackle-lab/ のように
  // リポジトリ名がURLに入る。これを指定しないと、画像やJSの読み込み先がずれて真っ白になる。
  base: '/tackle-lab/',

  // define：ビルドのときに、コードの中の決まった名前を値に置き換える仕組み。
  // JSON.stringify で囲むのは、置き換え後のコードで「文字列」として扱わせるため
  // （囲まないと 0.1.0 がそのままコードに入って文法エラーになる）。
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  // test：Vitest（試験の道具）の設定。
  test: {
    // 試験ファイルは src/ の中の *.test.js とする
    include: ['src/**/*.test.js'],
  },
})
