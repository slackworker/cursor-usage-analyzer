import { describe, expect, it } from 'vitest'
import { parseCsvText } from './parser'
import { normalizeModel } from './pricing'

function buildCsv(model: string, kind = 'Included') {
  return [
    'Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost',
    `2026-03-01T00:00:00.000Z,,,"${kind}","${model}",No,1000,2000,300,400,3700,${kind}`,
  ].join('\n')
}

describe('parseCsvText model resolution', () => {
  it('maps gpt-5.3-codex-xhigh to gpt-5.3-codex pricing', () => {
    const { events, meta } = parseCsvText(buildCsv('gpt-5.3-codex-xhigh'), 'test.csv')

    expect(events).toHaveLength(1)
    expect(events[0].rawModel).toBe('gpt-5.3-codex-xhigh')
    expect(events[0].model).toBe('gpt-5.3-codex')
    expect(events[0].skipReason).toBeNull()
    expect(events[0].pool).toBe('api')
    expect(events[0].costs.included).toBeCloseTo(0.0109025, 8)
    expect(meta.unknownModels).toEqual({})
    expect(meta.inferredModels).toEqual({
      'gpt-5.3-codex-xhigh': {
        count: 1,
        billingModel: 'gpt-5.3-codex',
      },
    })
  })

  it('normalizes known gpt suffixes to the base model', () => {
    const { events, meta } = parseCsvText(buildCsv('gpt-5.3-codex-high'), 'test.csv')

    expect(events[0].rawModel).toBe('gpt-5.3-codex-high')
    expect(events[0].model).toBe('gpt-5.3-codex')
    expect(events[0].skipReason).toBeNull()
    expect(events[0].costs.included).toBeCloseTo(0.0109025, 8)
    expect(meta.unknownModels).toEqual({})
    expect(meta.inferredModels).toEqual({
      'gpt-5.3-codex-high': {
        count: 1,
        billingModel: 'gpt-5.3-codex',
      },
    })
  })

  it('normalizes known claude suffixes to the base model', () => {
    const { events, meta } = parseCsvText(buildCsv('claude-4.6-sonnet-medium-thinking'), 'test.csv')

    expect(events[0].rawModel).toBe('claude-4.6-sonnet-medium-thinking')
    expect(events[0].model).toBe('claude-4.6-sonnet')
    expect(events[0].skipReason).toBeNull()
    expect(events[0].pool).toBe('api')
    expect(meta.unknownModels).toEqual({})
    expect(meta.inferredModels).toEqual({
      'claude-4.6-sonnet-medium-thinking': {
        count: 1,
        billingModel: 'claude-4.6-sonnet',
      },
    })
  })

  it('keeps truly unknown models in the unknown bucket', () => {
    const { events, meta } = parseCsvText(buildCsv('gpt-5.3-codex-unknown'), 'test.csv')

    expect(events[0].rawModel).toBe('gpt-5.3-codex-unknown')
    expect(events[0].model).toBe('gpt-5.3-codex-unknown')
    expect(events[0].skipReason).toBe('unknown_model')
    expect(meta.unknownModels).toEqual({ 'gpt-5.3-codex-unknown': 1 })
    expect(meta.inferredModels).toEqual({})
  })
})

describe('normalizeModel', () => {
  it('keeps canonical pricing keys unchanged', () => {
    expect(normalizeModel('gpt-5.4')).toBe('gpt-5.4')
    expect(normalizeModel('claude-4.6-sonnet')).toBe('claude-4.6-sonnet')
  })

  it('removes a single known suffix for gpt models', () => {
    expect(normalizeModel('gpt-5.4-medium')).toBe('gpt-5.4')
    expect(normalizeModel('gpt-5.3-codex-high')).toBe('gpt-5.3-codex')
    expect(normalizeModel('gpt-5.3-codex-xhigh')).toBe('gpt-5.3-codex')
  })

  it('removes a single known suffix for claude models', () => {
    expect(normalizeModel('claude-4.5-sonnet-thinking')).toBe('claude-4.5-sonnet')
    expect(normalizeModel('claude-4.6-opus-high-thinking')).toBe('claude-4.6-opus')
    expect(normalizeModel('claude-opus-4-7-thinking-high')).toBe('claude-opus-4-7')
  })

  it('does not chain multiple suffix removals', () => {
    expect(normalizeModel('gpt-5.3-codex-high-xhigh')).toBe('gpt-5.3-codex-high')
  })
})
