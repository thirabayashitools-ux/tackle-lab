/**
 * rigCalc.js — 仕掛けの長さの計算（全長・位置・底からの高さ・枝スの間隔）
 *
 * 計算の決まりは仕様書 docs/spec.md の 2.3 に書いてある。
 * 決まりを変えるときは、先に仕様書を直してから（CLAUDE.md 6章）。
 *
 * 用語：
 * - 軸：竿からオモリまで一直線につながる部分。parts を上から順に並べたもの
 * - 枝ス：軸から横に出る糸と針。軸の上では場所を取らない（長さ 0）
 * - 底からの高さ：オモリの上端（底に着く所）から、枝スの付け根までの距離
 *
 * つながっている所：
 * - rig.js の toLength で、使えない長さを 0 にそろえる
 * - 仕掛けエディタ（Issue #3）が結果を画面に出す
 * - 仕掛け図（Issue #4）が「上からの距離」を使ってパーツを縦に並べる
 * - rigCalc.test.js が試験する
 */
import { toLength } from './rig.js'

/**
 * 道糸かどうか。
 * 道糸は全長と位置の計算から外す（仕様書 2.3）。
 *
 * @param {object} part パーツ
 * @returns {boolean} 道糸なら true
 */
function isMainLine(part) {
  return part.kind === 'line' && part.role === 'michi'
}

/**
 * 仕掛けの長さをまとめて計算する。
 *
 * @param {object} rig 仕掛けのデータ（仕様書 2.1 の形）
 * @returns {{
 *   totalLength: number,
 *   baseFrom: 'sinker' | 'bottom',
 *   parts: Array<{ id: string, kind: string, top: number, bottom: number, fromBottomEnd: number }>,
 *   branches: Array<{ id: string, attachAt: number, heightFromBase: number, branchLength: number, hookTipHeight: number }>,
 *   branchSpacings: number[]
 * }}
 *   - totalLength：全長（cm）
 *   - baseFrom：底からの高さを、オモリの上端から測ったか（sinker）、軸の下の端から測ったか（bottom）
 *   - parts：道糸以外の各パーツの、上の端からの距離（top＝パーツの上側、bottom＝下側）と、
 *     軸の下の端からパーツの下側までの距離（fromBottomEnd）
 *   - branches：枝スごとの、付け根の位置（上の端から）・底からの高さ・枝スの長さ・針先の高さの目安
 *   - branchSpacings：となり合う枝スの付け根どうしの距離（上から順。枝スが n 本なら n−1 個）
 */
export function measureRig(rig) {
  // 道糸を外した「軸」のパーツ
  const axis = (rig.parts ?? []).filter((part) => !isMainLine(part))

  // --- 1. 各パーツの、上の端からの位置を順に積み上げる ---
  // cursor：いま見ているパーツの上側が、仕掛けの上の端から何cmの所にあるか
  let cursor = 0
  const placed = axis.map((part) => {
    // 枝スは軸の上で場所を取らないので 0（rig.js の createPart でも 0 にしているが、
    // 手で作ったデータや古いデータが来ても計算がずれないよう、ここでも 0 にする）
    const length = part.kind === 'branch' ? 0 : toLength(part.length)
    const top = cursor
    cursor += length
    return { part, top, bottom: cursor }
  })
  const totalLength = cursor

  // --- 2. 底からの高さを測る基準（オモリの上端）を決める ---
  // オモリが2つ以上あるときは、いちばん下のオモリを使う（仕様書 2.3【要確認】）。
  // findLast：配列を後ろ（下）から探して、最初に見つかったものを返す
  const lowestSinker = placed.findLast((p) => p.part.kind === 'sinker')
  // オモリがなければ、軸のいちばん下の端を基準にする
  const basePosition = lowestSinker ? lowestSinker.top : totalLength

  // --- 3. 枝スごとの高さ ---
  const branches = placed
    .filter((p) => p.part.kind === 'branch')
    .map(({ part, top }) => {
      const heightFromBase = basePosition - top
      const branchLength = toLength(part.line?.length)
      return {
        id: part.id,
        attachAt: top,
        // 付け根がオモリより下にあるとマイナスになる（ふつうの仕掛けではありえないが、
        // 入力の途中では起こりうる）。まちがいに気づけるよう、マイナスのまま返す。
        heightFromBase,
        branchLength,
        // 針先の高さの目安：枝スがまっすぐ垂れたとしたとき（仕様書 2.3）。
        // 底より下にはいかないので 0 で止める。
        hookTipHeight: Math.max(0, heightFromBase - branchLength),
      }
    })

  // --- 4. 枝スの間隔（上から順に、となりとの差） ---
  // slice(1) で2本目以降を取り、1つ前の枝スとの差を出す
  const branchSpacings = branches.slice(1).map((b, i) => b.attachAt - branches[i].attachAt)

  return {
    totalLength,
    baseFrom: lowestSinker ? 'sinker' : 'bottom',
    parts: placed.map(({ part, top, bottom }) => ({
      id: part.id,
      kind: part.kind,
      top,
      bottom,
      fromBottomEnd: totalLength - bottom,
    })),
    branches,
    branchSpacings,
  }
}
