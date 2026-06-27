import { describe, expect, it, beforeEach } from 'vitest'
import { useReportStore } from '../store/reportStore'

describe('reportStore', () => {
  beforeEach(() => {
    useReportStore.getState().clear()
  })

  it('starts with empty state', () => {
    const state = useReportStore.getState()
    expect(state.fileName).toBeNull()
    expect(state.fileContent).toBeNull()
    expect(state.events).toEqual([])
    expect(state.meta).toBeNull()
  })

  it('loads and parses csv file content locally', async () => {
    const csv = [
      'Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost',
      '2026-03-01T00:00:00.000Z,,,Included,auto,No,1000,0,0,100,1100,Included',
    ].join('\n')
    const file = new File([csv], 'test.csv', { type: 'text/csv' })
    await useReportStore.getState().setCsvFile(file)
    const state = useReportStore.getState()
    expect(state.fileName).toBe('test.csv')
    expect(state.fileContent).toBe(csv)
    expect(state.events.length).toBe(1)
    expect(state.meta?.rowCount).toBe(1)
  })
})
