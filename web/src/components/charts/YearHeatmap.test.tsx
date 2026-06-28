import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { YearHeatmap } from './YearHeatmap'

let lastCalendarRange: string[] | undefined

vi.mock('./EChart', () => ({
  EChart: (props: { option: { calendar?: { range?: string[] } } }) => {
    lastCalendarRange = props.option.calendar?.range
    return <div data-testid="echart-mock" />
  },
  baseTooltip: () => ({}),
}))

const crossYear = [
  { date: '2025-12-01', value: 1 },
  { date: '2026-01-15', value: 2 },
]

afterEach(() => {
  cleanup()
  lastCalendarRange = undefined
})

describe('YearHeatmap', () => {
  it('shows year switcher when data spans multiple years', () => {
    render(<YearHeatmap data={crossYear} />)

    expect(screen.getByRole('button', { name: '2025' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026' })).toBeInTheDocument()
    expect(lastCalendarRange).toEqual(['2026'])
  })

  it('switches calendar range when another year is selected', () => {
    render(<YearHeatmap data={crossYear} />)

    fireEvent.click(screen.getByRole('button', { name: '2025' }))
    expect(lastCalendarRange).toEqual(['2025'])
  })

  it('hides year switcher for single-year data', () => {
    render(<YearHeatmap data={[{ date: '2025-06-01', value: 1 }]} />)

    expect(screen.queryByRole('button', { name: '2025' })).not.toBeInTheDocument()
    expect(lastCalendarRange).toEqual(['2025'])
  })
})
