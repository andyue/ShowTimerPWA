import { test, expect, type Page, type Locator } from '@playwright/test'
import { createSocket } from 'node:dgram'

async function seed(page: import('@playwright/test').Page) {
  page.on('dialog', dialog => dialog.accept())
  await page.addInitScript(() => {
    if (localStorage.getItem('showtimer-current-project')) return
    localStorage.setItem('showtimer-current-project', JSON.stringify({
      format: 'ShowTimer', version: 2, projectId: 'e2e', projectName: 'Test Show', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      segments: [{ id: 'act', name: 'Act 1', type: 'act', order: 0, plannedSeconds: 30 }, { id: 'break', name: 'Intermission', type: 'intermission', order: 1, plannedSeconds: 20 }], results: [], cueMarks: [],
    }))
  })
  await page.goto('/')
}
const timer = (page: import('@playwright/test').Page) => page.locator('.desktop-layout .timer-column')

async function slide(page: Page, button: Locator, fraction = 1) {
  await button.scrollIntoViewIfNeeded()
  const box = (await button.boundingBox())!
  const track = (await button.locator('..').boundingBox())!
  const start = box.x + box.width / 2
  await page.mouse.move(start, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(start + (track.width - box.width - 16) * fraction, box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
}

async function execute(page: Page, button: Locator) {
  if (await button.evaluate(element => element.classList.contains('guarded-slide-thumb'))) {
    await slide(page, button)
  } else {
    await button.click()
  }
}

test('pause, restore after reload, resume, net cue time, finish paused with completed results', async ({ page }) => {
  await seed(page)
  const panel = timer(page)
  await execute(page, panel.getByRole('button', { name: 'Start Act 1' }))
  await expect(panel.locator('.timer-display')).toHaveText('00:00:01', { timeout: 4000 })
  await execute(page, panel.getByRole('button', { name: 'Pause 暫停' }))
  const frozen = await panel.locator('.timer-display').textContent()
  await expect(panel.locator('.pause-banner')).toContainText('本次暫停 00:00:01', { timeout: 4000 })
  await expect(panel.locator('.timer-display')).toHaveText(frozen!)
  await expect(page.locator('.desktop-layout').getByRole('button', { name: 'Add Mark' })).toBeDisabled()
  await page.reload()
  await expect(panel.locator('.pause-banner')).toContainText('演出暫停中')
  await expect(panel.locator('.timer-display')).toHaveText(frozen!)
  await execute(page, panel.getByRole('button', { name: 'Resume 繼續演出' }))
  await page.locator('.desktop-layout').getByRole('button', { name: 'Add Mark' }).click()
  const marks = await page.evaluate(() => JSON.parse(localStorage.getItem('showtimer-current-project')!).cueMarks)
  expect(marks[0].elapsedSeconds).toBeLessThan(3)
  await execute(page, panel.getByRole('button', { name: 'Pause 暫停' }))
  await panel.getByText('暫停紀錄（2 次）').click()
  await panel.getByLabel('暫停原因（選填，可事後補）').last().fill('音響異常')
  await execute(page, panel.getByRole('button', { name: '結束本段' }))
  await expect(panel.getByRole('heading', { name: 'Intermission', exact: true })).toBeVisible()
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('showtimer-current-project')!).results[0])
  expect(result.pauses).toHaveLength(2)
  expect(result.pauses[1].note).toBe('音響異常')
  expect(result.pauses[1].endedAtMs).not.toBeNull()
  expect(result.pausedSeconds).toBeGreaterThanOrEqual(1)
  await execute(page, panel.getByRole('button', { name: 'Pause 暫停' }))
  const countdown = await panel.locator('.timer-display').textContent()
  await expect(panel.locator('.pause-banner')).toContainText('本次暫停 00:00:01')
  await expect(panel.locator('.timer-display')).toHaveText(countdown!)
  await page.screenshot({ path: '/tmp/showtimer-desktop.png', fullPage: true })
})

test('broadcast late join, pause/resume, reconnect and read-only mobile viewer', async ({ page, browser }) => {
  await seed(page)
  const tools = page.locator('.desktop-layout .tools-column')
  await tools.getByLabel('同步服務位址').fill('ws://127.0.0.1:8787')
  await tools.getByRole('button', { name: '開啟廣播', exact: true }).click()
  await expect(tools.getByText('廣播中', { exact: true })).toBeVisible()
  await execute(page, timer(page).getByRole('button', { name: 'Start Act 1' }))
  const link = await tools.getByRole('link', { name: '開啟唯讀觀看畫面' }).getAttribute('href')
  const hostToken = await page.evaluate(() => JSON.parse(sessionStorage.getItem('showtimer-broadcast')!).hostToken)
  expect(link).not.toContain(hostToken)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const viewer = await context.newPage(); await viewer.goto(link!)
  await expect(viewer.getByRole('heading', { name: 'Act 1' })).toBeVisible()
  await expect(viewer.getByRole('button', { name: /Pause|Start|Next|Add Mark/ })).toHaveCount(0)
  await execute(page, timer(page).getByRole('button', { name: 'Pause 暫停' }))
  await expect(viewer.locator('.pause-banner')).toContainText('演出暫停中')
  const frozen = await viewer.locator('.viewer-time').textContent()
  await expect(viewer.locator('.pause-banner')).toContainText('本次暫停 00:00:01')
  await expect(viewer.locator('.viewer-time')).toHaveText(frozen!)
  await context.setOffline(true)
  await execute(page, timer(page).getByRole('button', { name: 'Resume 繼續演出' }))
  await context.setOffline(false); await viewer.reload()
  await expect(viewer.locator('.pause-banner')).toHaveCount(0)
  await expect(viewer.getByText('已同步 · 唯讀觀看')).toBeVisible()
  await page.reload()
  await expect(tools.getByText('廣播中', { exact: true })).toBeVisible()
  await execute(page, timer(page).getByRole('button', { name: 'Pause 暫停' }))
  await expect(viewer.locator('.pause-banner')).toContainText('演出暫停中')
  await viewer.screenshot({ path: '/tmp/showtimer-viewer-mobile.png', fullPage: true })
  await tools.getByRole('button', { name: '停止廣播', exact: true }).click()
  await expect(viewer.getByText('廣播已結束', { exact: true })).toBeVisible()
  await context.close()
})

test('QLab-style UDP commands control paired browser without duplicate pause or paused next', async ({ page }) => {
  await seed(page)
  const tools = page.locator('.desktop-layout .tools-column')
  await tools.getByLabel('橋接程式顯示的配對碼').fill('e2e-pairing')
  await tools.getByRole('button', { name: '連接 OSC', exact: true }).click()
  await expect(tools.getByText('已連線 · OSC 就緒')).toBeVisible()
  const udp = createSocket('udp4')
  const send = (command: string) => new Promise<void>((resolve, reject) => {
    const address = Buffer.from(`/showtimer/${command}\0`)
    const padded = Buffer.alloc(Math.ceil(address.length / 4) * 4); address.copy(padded)
    udp.send(Buffer.concat([padded, Buffer.from(',\0\0\0')]), 53001, '127.0.0.1', error => error ? reject(error) : resolve())
  })
  try {
    await send('start'); await expect(timer(page).getByRole('button', { name: 'Pause 暫停' })).toBeVisible()
    await send('pause'); await send('pause')
    await expect(timer(page).getByText('暫停紀錄（1 次）')).toBeVisible()
    await send('next'); await expect(tools.getByText('已連線 · 收到 next')).toBeVisible()
    await expect(timer(page).locator('.pause-banner')).toBeVisible()
    await send('resume'); await expect(timer(page).locator('.pause-banner')).toHaveCount(0)
    await send('mark'); await expect(page.locator('.desktop-layout .qmark-table tbody tr')).toContainText('Act 1')
  } finally { udp.close() }
})

test('mobile controller keeps pause/resume reachable and restores active time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page)
  const panel = page.locator('.mobile-layout')
  await execute(page, panel.getByRole('button', { name: 'Start Act 1' }))
  await expect(panel.locator('.timer-display')).toHaveText('00:00:01', { timeout: 4000 })
  await page.reload()
  await expect(panel.getByRole('button', { name: 'Pause 暫停' })).toBeVisible()
  await execute(page, panel.getByRole('button', { name: 'Pause 暫停' }))
  await expect(panel.getByRole('button', { name: 'Resume 繼續演出' })).toBeInViewport()
  await page.screenshot({ path: '/tmp/showtimer-controller-mobile.png', fullPage: true })
  await execute(page, panel.getByRole('button', { name: 'Resume 繼續演出' }))
  await expect(panel.locator('.pause-banner')).toHaveCount(0)
})

for (const mobile of [false, true]) {
  test(`Q Marks rerun insertion and persisted row moves (${mobile ? 'mobile tabs' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await seed(page)
    await page.evaluate(() => {
      const project = JSON.parse(localStorage.getItem('showtimer-current-project')!)
      project.cueMarks = [60, 10].map((seconds, index) => ({
        id: String(index), label: `M${index + 1}`, segmentId: 'act', segmentOrder: 0,
        segmentName: 'Act 1', segmentType: 'act', elapsedSeconds: seconds,
        note: `old-${seconds}`, createdAt: '2026-01-01T00:00:00Z',
      }))
      localStorage.setItem('showtimer-current-project', JSON.stringify(project))
    })
    await page.reload()
    const layout = page.locator(mobile ? '.mobile-layout' : '.desktop-layout')
    if (mobile) await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await execute(page, layout.getByRole('button', { name: 'Start Act 1' }))
    await execute(page, layout.getByRole('button', { name: 'Next: Intermission' }))
    await execute(page, layout.getByRole('button', { name: 'Finish', exact: true }))
    await execute(page, layout.getByRole('button', { name: 'Reset Run' }))
    await execute(page, layout.getByRole('button', { name: 'Start Act 1' }))
    if (mobile) await page.getByRole('button', { name: 'Q Marks', exact: true }).click()
    await layout.getByRole('button', { name: 'Add Mark' }).click()
    const rows = layout.locator('.qmark-table tbody tr')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0).locator('textarea')).toHaveValue('')
    await expect(rows.nth(1).locator('textarea')).toHaveValue('old-10')
    await expect(rows.nth(2).locator('textarea')).toHaveValue('old-60')
    await layout.getByRole('button', { name: '下移 Q1', exact: true }).click()
    await expect(rows.nth(0).locator('textarea')).toHaveValue('old-10')
    if (mobile) {
      await page.getByRole('button', { name: 'Timer', exact: true }).click()
      await page.getByRole('button', { name: 'Q Marks', exact: true }).click()
      await expect(rows.nth(0).locator('textarea')).toHaveValue('old-10')
    }
    await page.reload()
    if (mobile) await page.getByRole('button', { name: 'Q Marks', exact: true }).click()
    await expect(rows.nth(0).locator('textarea')).toHaveValue('old-10')
    await expect(layout.getByRole('button', { name: '上移 Q1', exact: true })).toBeDisabled()
    await expect(layout.getByRole('button', { name: '下移 Q3', exact: true })).toBeDisabled()
  })
}


test('desktop safety confirmation can cancel and Qmark stays immediate', async ({ page }) => {
  await seed(page)
  page.removeAllListeners('dialog')
  const start = timer(page).getByRole('button', { name: 'Start Act 1' })
  page.once('dialog', dialog => dialog.dismiss())
  await start.click()
  await expect(start).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await start.click()
  const next = timer(page).getByRole('button', { name: 'Next: Intermission' })
  page.once('dialog', dialog => dialog.dismiss())
  await next.click()
  await expect(next).toBeVisible()
  await page.locator('.desktop-layout').getByRole('button', { name: 'Add Mark' }).click()
  await expect(page.locator('.desktop-layout .qmark-table textarea')).toHaveCount(1)
})

test('mobile rejects taps, incomplete and cancelled swipes; keyboard confirms', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page)
  page.removeAllListeners('dialog')
  const panel = page.locator('.mobile-layout')
  const start = panel.getByRole('button', { name: 'Start Act 1' })
  await start.click()
  await expect(start).toBeVisible()
  await slide(page, start, 0.5)
  await expect(start).toBeVisible()
  const box = (await start.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 100, box.y + 20)
  await start.dispatchEvent('pointercancel')
  await page.mouse.up()
  await expect(start).toBeVisible()
  await slide(page, start)
  const pause = panel.getByRole('button', { name: 'Pause 暫停' })
  await expect(pause).toBeVisible()
  await pause.focus()
  page.once('dialog', dialog => dialog.dismiss())
  await pause.press('Enter')
  await expect(pause).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await pause.press('Enter')
  await expect(panel.locator('.pause-banner')).toBeVisible()
  await page.screenshot({ path: '/tmp/showtimer-guarded-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const resume = timer(page).getByRole('button', { name: 'Resume 繼續演出' })
  page.once('dialog', dialog => dialog.accept())
  await resume.click()
  await expect(timer(page).getByRole('button', { name: 'Pause 暫停' })).toBeVisible()
})

for (const mobile of [false, true]) {
  test(`Qmark compact rows grow and shrink with note wrapping (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await seed(page)
    const layout = page.locator(mobile ? '.mobile-layout' : '.desktop-layout')
    await execute(page, layout.getByRole('button', { name: 'Start Act 1' }))
    if (mobile) await page.getByRole('button', { name: 'Q Marks', exact: true }).click()
    await layout.getByRole('button', { name: 'Add Mark' }).click()
    const row = layout.locator('.qmark-table tbody tr').first()
    const note = row.locator('textarea')
    const initial = (await row.boundingBox())!.height
    expect(initial).toBeLessThanOrEqual(50)
    await expect(row.locator('td').nth(0).getByRole('button', { name: '上移 Q1' })).toBeVisible()
    await expect(row.locator('td').nth(1)).toHaveText('1')
    await note.fill('燈光 GO\n音樂淡入\n第三行\n第四行')
    await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(initial)
    expect(await note.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
    await note.fill('這是一段需要依照欄位寬度自動換行的舞台提示。'.repeat(4))
    await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(initial)
    expect(await note.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await note.fill('GO')
    await expect.poll(async () => (await row.boundingBox())!.height).toBe(initial)
    await page.screenshot({ path: `/tmp/qmark-compact-${mobile ? 'mobile' : 'desktop'}.png` })
  })
}

for (const mobile of [false, true]) {
  test(`Sub timer records independently and restores across reload (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await seed(page)
    const layout = page.locator(mobile ? '.mobile-layout' : '.desktop-layout')
    const sub = layout.getByRole('region', { name: 'Sub timer', exact: true })
    await sub.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(sub.locator('output')).toHaveText('00:01')
    await expect(layout.locator('.timer-display')).toHaveText('00:00:00')
    await page.reload()
    await expect(sub.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await sub.getByRole('button', { name: 'Stop', exact: true }).click()
    await layout.getByText('技術執行紀錄（1 次）').click()
    await layout.getByLabel('技術執行備註（選填，可事後補）').fill('換景測試')
    await sub.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(sub.locator('output')).toHaveText('00:00')
    await expect(layout.getByLabel('技術執行備註（選填，可事後補）')).toHaveValue('換景測試')
    await sub.getByRole('button', { name: 'Start', exact: true }).click()
    await sub.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(layout.getByText('技術執行紀錄（2 次）')).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('showtimer-current-project')!))
    expect(saved.subTimer.records).toHaveLength(2)
    expect(saved.subTimer.records.every((record: { endedAtMs: number | null }) => record.endedAtMs !== null)).toBe(true)
    expect(saved.cueMarks).toHaveLength(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/sub-timer-${mobile ? 'mobile' : 'desktop'}.png` })
  })
}
