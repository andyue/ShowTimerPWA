import type { ShowProject } from '../models/ShowProject'

const STORAGE_KEY = 'showtimer-current-project'

export function saveProject(project: ShowProject) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(project),
  )
}

export function loadProject(): ShowProject | null {
  const json = localStorage.getItem(STORAGE_KEY)

  if (!json) {
    return null
  }

  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function clearProject() {
  localStorage.removeItem(STORAGE_KEY)
}