/**
 * main.jsx — React を起動するファイル
 *
 * index.html の <div id="root"> を見つけて、その中に App（画面全体）を描く。
 * 画面の中身を変えたいときは、このファイルではなく App.jsx を直す。
 *
 * .jsx：JavaScript の中に HTML に似た書き方（JSX）を混ぜられるファイル。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// StrictMode：開発中だけ、まちがいやすい書き方を警告してくれる React の仕組み。
// 公開版（ビルド後）の動きには影響しない。
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
