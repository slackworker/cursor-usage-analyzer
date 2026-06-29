import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export const examplesDir = join(root, 'examples')

export function localExamplePath(filename: string): string {
  return join(examplesDir, filename)
}

export function hasLocalExample(filename: string): boolean {
  return existsSync(localExamplePath(filename))
}
