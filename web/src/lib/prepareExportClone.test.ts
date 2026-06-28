import { afterEach, describe, expect, it } from 'vitest'
import { prepareExportClone } from './prepareExportClone'

describe('prepareExportClone', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hides elements marked for export', () => {
    document.body.innerHTML = '<button data-export-hide>导出</button>'
    prepareExportClone(document)
    expect(document.querySelector<HTMLElement>('[data-export-hide]')?.style.display).toBe('none')
  })

  it('replaces select with a static span showing the selected label', () => {
    document.body.innerHTML = `
      <select class="filter-bar__select">
        <option value="all">全部</option>
        <option value="7d" selected>7 天</option>
      </select>
    `
    prepareExportClone(document)

    const select = document.querySelector('select')!
    expect(select.style.display).toBe('none')

    const replacement = select.nextElementSibling
    expect(replacement?.tagName).toBe('SPAN')
    expect(replacement?.textContent).toBe('7 天')
    expect(replacement?.className).toBe('filter-bar__select')
  })

  it('replaces date and number inputs with static spans', () => {
    document.body.innerHTML = `
      <input type="date" class="filter-bar__input" value="2026-01-15" />
      <input type="number" class="filter-bar__input" value="145" />
    `
    prepareExportClone(document)

    const dateInput = document.querySelector<HTMLInputElement>('input[type="date"]')!
    expect(dateInput.nextElementSibling?.textContent).toBe('2026-01-15')

    const numberInput = document.querySelector<HTMLInputElement>('input[type="number"]')!
    expect(numberInput.nextElementSibling?.textContent).toBe('145')
  })
})
