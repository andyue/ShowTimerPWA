export function parseMarkTime(text: string): number | null {
  const match = /^(\d{1,5}):([0-5]\d):([0-5]\d)$/.exec(text.trim())
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null
}
