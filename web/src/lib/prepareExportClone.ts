function getSelectDisplayText(select: HTMLSelectElement): string {
  const option = select.options[select.selectedIndex]
  return option?.text ?? select.value
}

function applyComputedStyles(replacement: HTMLElement, el: HTMLElement, view: Window): void {
  const computed = view.getComputedStyle(el)
  replacement.style.boxSizing = computed.boxSizing
  replacement.style.display = 'inline-flex'
  replacement.style.alignItems = 'center'
  replacement.style.justifyContent = 'flex-start'
  replacement.style.width = computed.width
  replacement.style.height = computed.height
  replacement.style.minWidth = computed.minWidth
  replacement.style.minHeight = computed.minHeight
  replacement.style.padding = computed.padding
  replacement.style.border = computed.border
  replacement.style.borderRadius = computed.borderRadius
  replacement.style.backgroundColor = computed.backgroundColor
  replacement.style.color = computed.color
  replacement.style.fontSize = computed.fontSize
  replacement.style.fontFamily = computed.fontFamily
  replacement.style.fontWeight = computed.fontWeight
  replacement.style.lineHeight = 'normal'
  replacement.style.whiteSpace = 'nowrap'
  replacement.style.overflow = 'hidden'
  replacement.style.textOverflow = 'ellipsis'
}

function replaceFormControl(el: HTMLElement, text: string, doc: Document): void {
  const replacement = doc.createElement('span')
  replacement.textContent = text
  replacement.className = el.className
  replacement.setAttribute('data-export-static', 'true')
  replacement.setAttribute('aria-hidden', 'true')

  const view = doc.defaultView
  if (view) {
    applyComputedStyles(replacement, el, view)
  } else {
    replacement.style.display = 'inline-flex'
    replacement.style.alignItems = 'center'
    replacement.style.lineHeight = 'normal'
    replacement.style.whiteSpace = 'nowrap'
  }

  el.style.display = 'none'
  el.insertAdjacentElement('afterend', replacement)
}

/** Normalize cloned DOM so html2canvas renders form controls correctly. */
export function prepareExportClone(doc: Document): void {
  doc.querySelectorAll<HTMLElement>('[data-export-hide]').forEach((el) => {
    el.style.display = 'none'
  })

  doc.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    replaceFormControl(select, getSelectDisplayText(select), doc)
  })

  doc
    .querySelectorAll<HTMLInputElement>('input[type="date"], input[type="number"]')
    .forEach((input) => {
      replaceFormControl(input, input.value, doc)
    })
}
