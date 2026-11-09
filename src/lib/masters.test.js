/**
 * masters.test.js — masters.js（標準のマスタ）の試験
 *
 * 決まりは仕様書 docs/spec.md の 2.2「マスタ」。
 */
import { describe, it, expect } from 'vitest'
import {
  MATERIALS,
  PRODUCTS,
  KNOT_STYLES,
  getMaterial,
  getProduct,
  getKnotStyle,
  productsForKind,
  sinkerWeightGrams,
} from './masters.js'

describe('標準のマスタの中身', () => {
  it('id が重ならない（重なると、どちらを指しているか分からなくなる）', () => {
    for (const list of [MATERIALS, PRODUCTS, KNOT_STYLES]) {
      const ids = list.map((item) => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('製品が指す素材は、すべて素材の一覧にある', () => {
    for (const product of PRODUCTS) {
      expect(getMaterial(product.material), product.id).not.toBeNull()
    }
  })

  it('仕様書 2.2 のアマダイの例で使う id が、すべてある', () => {
    for (const id of [
      'std-swivel-8',
      'std-fluoro-5',
      'std-fluoro-3',
      'std-hook-amadai-12',
      'std-nylon-3',
      'std-sinker-80',
    ]) {
      expect(getProduct(id), id).not.toBeNull()
    }
    for (const id of ['clinch', 'edasu', 'sotogake', 'densha']) {
      expect(getKnotStyle(id), id).not.toBeNull()
    }
  })

  it('製品名は読める形（フロロ 3号（標準））', () => {
    expect(getProduct('std-fluoro-3').name).toBe('フロロ 3号（標準）')
    expect(getProduct('std-fluoro-1.5').gou).toBe(1.5)
  })

  it('マスタは書き換えられない（書き換えるとエラー）', () => {
    // 'use strict' の中（ES モジュールは常にそう）では、止めた値への書き込みはエラーになる
    expect(() => {
      PRODUCTS[0].name = 'いたずら'
    }).toThrow()
  })
})

describe('引くための関数', () => {
  it('見つからない id は null（分からないとして扱う）', () => {
    expect(getProduct('no-such')).toBeNull()
    expect(getProduct(null)).toBeNull()
    expect(getMaterial(undefined)).toBeNull()
    expect(getKnotStyle('')).toBeNull()
  })

  it('種類に合う製品だけを出す', () => {
    const sinkers = productsForKind('sinker')
    expect(sinkers.length).toBeGreaterThan(0)
    expect(sinkers.every((p) => p.kinds.includes('sinker'))).toBe(true)
    expect(productsForKind('kani')).toEqual([])
  })
})

describe('sinkerWeightGrams：オモリの号数から重さ', () => {
  it('1号＝3.75g', () => {
    expect(sinkerWeightGrams(1)).toBe(3.75)
    expect(sinkerWeightGrams(80)).toBe(300)
  })

  it('号数が分からないときは null', () => {
    expect(sinkerWeightGrams(null)).toBeNull()
    expect(sinkerWeightGrams(-1)).toBeNull()
    expect(sinkerWeightGrams('80')).toBeNull()
  })
})
