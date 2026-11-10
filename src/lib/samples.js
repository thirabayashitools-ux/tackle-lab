/**
 * samples.js — 見本のリグ（仕掛け）
 *
 * 仕様書 docs/spec.md 2.2 の「例：アマダイ胴付き 2本針」と同じ中身。
 * 使い道：
 * - 画面：エディタ（#3）ができるまで、図（#4）を確かめるための見本として出す
 * - 試験：rigLayout.test.js が、図の置き方をこの見本で確かめる
 *
 * id は読みやすさのため短い名前にしている（仕様書の例と同じ）。
 * 実際にエディタで作るパーツ・接続の id は UUID になる。
 *
 * つながっている所：rig.js の形（版2）・masters.js の製品と結び方の id
 */
import { RIG_SCHEMA_VERSION } from './rig.js'

/**
 * アマダイ胴付き 2本針の見本を作る。
 *
 * タックル側から：サルカン → 幹糸 110cm（40cm・100cm に枝ス 30cm と針）→ 捨て糸 50cm → オモリ 5cm
 *
 * なぜ関数にしているか（定数にしないのか）：呼ぶたびに新しいデータを返すため。
 * 1つのデータを使い回すと、どこかで書き換えたときに、ほかの所の見本まで変わってしまう。
 *
 * @returns {object} リグ（仕様書 2.2 の形）
 */
export function sampleAmadaiRig() {
  return {
    schemaVersion: RIG_SCHEMA_VERSION,
    id: 'sample-amadai',
    name: 'アマダイ胴付き 2本針（見本）',
    memo: '',
    derivedFrom: null,
    tackleSide: { part: 'swv', point: 'a' },
    lengthStart: null,
    lengthEnd: null,
    bottom: { part: 'snk', point: 'tip' },
    createdAt: '2026-11-09T04:00:00.000Z',
    updatedAt: '2026-11-09T04:00:00.000Z',
    parts: [
      { id: 'swv', kind: 'swivel', product: 'std-swivel-8',
        points: [{ id: 'a', at: 0, form: 'ring' }, { id: 'b', at: 0, form: 'ring' }] },
      { id: 'main', kind: 'line', role: 'mikiito', product: 'std-fluoro-5',
        points: [{ id: 'start', at: 0 }, { id: 'e1', at: 40 }, { id: 'e2', at: 100 }, { id: 'end', at: 110 }] },
      { id: 'br1', kind: 'line', role: 'edasu', product: 'std-fluoro-3',
        points: [{ id: 'start', at: 0 }, { id: 'end', at: 30 }] },
      { id: 'hook1', kind: 'hook', product: 'std-hook-amadai-12',
        points: [{ id: 'tie', at: 0 }] },
      { id: 'br2', kind: 'line', role: 'edasu', product: 'std-fluoro-3',
        points: [{ id: 'start', at: 0 }, { id: 'end', at: 30 }] },
      { id: 'hook2', kind: 'hook', product: 'std-hook-amadai-12',
        points: [{ id: 'tie', at: 0 }] },
      { id: 'sute', kind: 'line', role: 'sute', product: 'std-nylon-3',
        points: [{ id: 'start', at: 0 }, { id: 'end', at: 50 }] },
      { id: 'snk', kind: 'sinker', product: 'std-sinker-80',
        points: [{ id: 'ring', at: 0, form: 'ring' }, { id: 'tip', at: 5 }] },
    ],
    joints: [
      { id: 'j1', type: 'knot', knotStyle: 'clinch',
        ends: [{ part: 'swv', point: 'b' }, { part: 'main', point: 'start' }] },
      { id: 'j2', type: 'knot', knotStyle: 'edasu',
        ends: [{ part: 'main', point: 'e1' }, { part: 'br1', point: 'start' }] },
      { id: 'j3', type: 'knot', knotStyle: 'sotogake',
        ends: [{ part: 'br1', point: 'end' }, { part: 'hook1', point: 'tie' }] },
      { id: 'j4', type: 'knot', knotStyle: 'edasu',
        ends: [{ part: 'main', point: 'e2' }, { part: 'br2', point: 'start' }] },
      { id: 'j5', type: 'knot', knotStyle: 'sotogake',
        ends: [{ part: 'br2', point: 'end' }, { part: 'hook2', point: 'tie' }] },
      { id: 'j6', type: 'knot', knotStyle: 'densha',
        ends: [{ part: 'main', point: 'end' }, { part: 'sute', point: 'start' }] },
      { id: 'j7', type: 'knot', knotStyle: 'clinch',
        ends: [{ part: 'sute', point: 'end' }, { part: 'snk', point: 'ring' }] },
    ],
    layout: {},
  }
}
