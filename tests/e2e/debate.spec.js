import { expect, test } from '@playwright/test'

const LONG =
  'We affirm. First, this policy protects people who are harmed today and the evidence from every country that tried it shows it works. Second, the alternative has failed for decades and my opponent offers no plan to fix it. Weigh the round on lives improved.'
const SHORT = 'We negate because it costs too much and freedom matters more than this policy.'

const shots = process.env.JALPA_SCREENSHOTS

async function snap(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true })
}

async function newDebater(browser, name, speech, viewport) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript((words) => {
    window.__jalpaTestSpeech = () => words
  }, speech)
  const page = await context.newPage()
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await snap(page, `00-login-${viewport.width}`)
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Name shown to opponents').fill(name)
  await page.getByLabel('Email').fill(`${name.toLowerCase()}-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('correct-horse')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return page
}

test('two people debate, get a ballot, and the ratings move', async ({ browser }) => {
  const ana = await newDebater(browser, 'Ana', LONG, { width: 1280, height: 900 })
  const ben = await newDebater(browser, 'Ben', SHORT, { width: 390, height: 844 })

  // A fresh account starts at 1000 with nothing on the board.
  await expect(ana.locator('.record__rating')).toHaveText('1000')
  await expect(ana.getByText('Nothing here yet')).toBeVisible()
  await snap(ana, '01-home-empty')

  // Both look for a debate; "any subject" pairs with a specific one.
  await ana.getByRole('link', { name: 'Find a debate' }).click()
  await expect(ana.getByRole('heading', { name: 'Pick a subject' })).toBeVisible()
  await snap(ana, '02-choose-subject')
  await ana.getByRole('button', { name: /Science and technology/ }).click()
  await expect(ana.getByRole('heading', { name: 'Looking for an opponent' })).toBeVisible()
  await snap(ana, '03-searching')

  await ben.getByRole('link', { name: 'Find a debate' }).click()
  await expect(ben.getByRole('heading', { name: 'Pick a subject' })).toBeVisible()
  await snap(ben, '02-choose-subject-phone')
  await ben.getByRole('button', { name: /Any subject/ }).click()

  await expect(ana).toHaveURL(/\/debate\//)
  await expect(ben).toHaveURL(/\/debate\//)
  expect(new URL(ana.url()).pathname).toBe(new URL(ben.url()).pathname)
  const debatePath = new URL(ana.url()).pathname

  // Prep: same resolution for both, opposite sides.
  const topic = await ana.locator('.resolution__text').innerText()
  await expect(ben.locator('.resolution__text')).toHaveText(topic)
  await expect(ana.getByText('Science and technology.')).toBeVisible()
  const anaSide = (await ana.locator('.matchup__role').first().innerText()).includes('Pro') ? 'pro' : 'con'
  const benSide = (await ben.locator('.matchup__role').first().innerText()).includes('Pro') ? 'pro' : 'con'
  expect(anaSide).not.toBe(benSide)
  await expect(ana.getByText('Microphone connected')).toBeVisible()
  await snap(ana, '04-prep')
  await snap(ben, '04-prep-phone')

  await ana.getByRole('button', { name: 'I’m ready' }).click()
  await expect(ana.getByText('Waiting for Ben')).toBeVisible()
  await ben.getByRole('button', { name: 'I’m ready' }).click()

  const pro = anaSide === 'pro' ? ana : ben
  const con = anaSide === 'pro' ? ben : ana
  const order = [
    ['Pro constructive', pro, con],
    ['Con constructive', con, pro],
    ['Pro rebuttal', pro, con],
    ['Con rebuttal', con, pro],
    ['Pro closing', pro, con],
    ['Con closing', con, pro],
  ]

  for (const [index, [name, speaker, listener]] of order.entries()) {
    await expect(speaker.locator('.stage__speech')).toHaveText(name)
    await expect(listener.locator('.stage__speech')).toHaveText(name)
    await expect(speaker.getByText('Your microphone is on.')).toBeVisible()
    await expect(listener.getByText(/Your microphone is off while/)).toBeVisible()
    await expect(listener.getByRole('button', { name: 'End my speech' })).toHaveCount(0)
    await expect(speaker.getByText('You’re speaking')).toBeVisible()
    // The listener sees the speaker's live captions.
    await expect(listener.locator('.captions')).toContainText(/We (affirm|negate)/)
    if (index === 0) {
      await snap(speaker, '05-speaking')
      await snap(listener, '05-listening')
    }
    if (index < 4) {
      // Give the recorder a moment, then yield the rest of the time.
      await speaker.waitForTimeout(1200)
      await speaker.getByRole('button', { name: 'End my speech' }).click()
    }
    // The two closings run until the clock moves the debate on by itself.
  }

  // Judging, then the ballot.
  if (shots) {
    const judging = ana.getByRole('heading', { name: 'The judge is deciding' })
    if (await judging.isVisible({ timeout: 15_000 }).catch(() => false)) await snap(ana, '055-judging')
  }
  await expect(ana.getByRole('heading', { name: 'You won' })).toBeVisible({ timeout: 60_000 })
  await expect(ben.getByRole('heading', { name: 'You lost' })).toBeVisible({ timeout: 60_000 })
  await expect(ana.locator('.ballot__change')).toHaveText('+16')
  await expect(ben.locator('.ballot__change')).toHaveText('−16')
  await expect(ana.getByText('Rating 1000 to 1016')).toBeVisible()
  await expect(ana.getByRole('heading', { name: 'Reason for decision' })).toBeVisible()
  await expect(ana.locator('.scores tfoot')).toContainText('31')
  await ana.getByText('Read the transcript').click()
  await expect(ana.locator('.transcript')).toContainText('We affirm. First, this policy')
  await expect(ana.locator('.transcript')).toContainText('We negate because it costs too much')
  await snap(ana, '06-ballot-won')
  await snap(ben, '06-ballot-lost-phone')

  // Ratings and history are updated everywhere.
  await ana.getByRole('navigation').getByRole('link', { name: 'Leaderboard' }).click()
  const rows = ana.locator('.board tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Ana')
  await expect(rows.nth(0)).toContainText('1016')
  await expect(rows.nth(1)).toContainText('Ben')
  await expect(rows.nth(1)).toContainText('984')
  await snap(ana, '07-leaderboard')

  if (shots) {
    await ben.getByRole('navigation').getByRole('link', { name: 'Leaderboard' }).click()
    await expect(ben.locator('.board tbody tr')).toHaveCount(2)
    await snap(ben, '07-leaderboard-phone')
  }
  await ben.getByRole('navigation').getByRole('link', { name: 'Home' }).click()
  await expect(ben.locator('.record__rating')).toHaveText('984')
  await expect(ben.locator('.match')).toContainText('Lost')
  await expect(ben.locator('.match')).toContainText(topic)
  await snap(ben, '08-home-after-phone')
  await ana.goto('/')
  await expect(ana.getByRole('heading', { level: 1, name: 'Ana' })).toBeVisible()
  await snap(ana, '08-home-after')
  if (shots) {
    await ana.emulateMedia({ colorScheme: 'dark' })
    await snap(ana, '09-home-dark')
    await ana.goto(debatePath)
    await expect(ana.getByRole('heading', { name: 'You won' })).toBeVisible()
    await snap(ana, '09-ballot-dark')
    await ana.emulateMedia({ colorScheme: 'light' })
  }

  // The ballot can be reopened from history.
  await ben.locator('.match').click()
  await expect(ben.getByRole('heading', { name: 'You lost' })).toBeVisible()
})

test('forfeiting hands the win to the opponent, and outsiders are kept out', async ({ browser }) => {
  const cat = await newDebater(browser, 'Cat', LONG, { width: 1100, height: 800 })
  const dev = await newDebater(browser, 'Dev', SHORT, { width: 1100, height: 800 })
  const eve = await newDebater(browser, 'Eve', SHORT, { width: 1100, height: 800 })

  for (const page of [cat, dev]) {
    await page.getByRole('link', { name: 'Find a debate' }).click()
    await page.getByRole('button', { name: /Ethics and philosophy/ }).click()
  }
  await expect(cat).toHaveURL(/\/debate\//)
  await expect(dev).toHaveURL(/\/debate\//)

  // Someone who isn't in the debate can't open it.
  await eve.goto(new URL(cat.url()).pathname)
  await expect(eve.getByRole('heading', { name: 'This debate isn’t available' })).toBeVisible()

  // Reloading mid-debate brings you straight back in.
  await cat.reload()
  await expect(cat.locator('.resolution__text')).toBeVisible()

  await dev.getByRole('button', { name: 'Forfeit', exact: true }).click()
  await dev.getByRole('button', { name: 'Keep debating' }).click()
  await dev.getByRole('button', { name: 'Forfeit', exact: true }).click()
  await dev.getByRole('button', { name: 'Forfeit debate' }).click()

  await expect(dev.getByRole('heading', { name: 'You lost' })).toBeVisible()
  await expect(dev.getByText('You forfeited.')).toBeVisible()
  await expect(cat.getByRole('heading', { name: 'You won' })).toBeVisible()
  await expect(cat.getByText('Dev forfeited.')).toBeVisible()

  // Renaming yourself works and shows on the leaderboard.
  await cat.getByRole('navigation').getByRole('link', { name: 'Home' }).click()
  await cat.getByRole('button', { name: 'Change name' }).click()
  await cat.getByLabel('Display name').fill('Catalina')
  await cat.getByRole('button', { name: 'Save name' }).click()
  await expect(cat.getByRole('heading', { level: 1, name: 'Catalina' })).toBeVisible()

  // Signing out (from the account menu) returns to the login page.
  await cat.getByRole('button', { name: 'Account' }).click()
  await cat.getByRole('button', { name: 'Sign out' }).click()
  await expect(cat).toHaveURL(/\/login$/)
})
