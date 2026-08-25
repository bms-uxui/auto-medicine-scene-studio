import { chromium } from 'playwright'
const [port, scene, tag, ...rest] = process.argv.slice(2)
const TIMES = rest.map(Number)
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport:{width:1600,height:1000} })
p.on('pageerror', e=>console.log('PAGEERROR', e.message))
await p.goto(`http://localhost:${port}/`, {waitUntil:'networkidle'})
await p.waitForFunction(()=>window.__studio, null, {timeout:20000})
await p.evaluate((s)=>window.__studio.getState().setScene(s), scene)
await new Promise(r=>setTimeout(r,4000))
let prev = 0
for (const t of TIMES) {
  await p.evaluate(async ({from,to})=>{
    const s = window.__studio.getState()
    for (let x = from; x < to; x += 1/30) s.setTime(x)
    s.setTime(to)
  }, {from: prev, to: t})
  prev = t
  await new Promise(r=>setTimeout(r,1100))
  await p.locator('.viewport').screenshot({path:`/private/tmp/claude-501/-Users-joeos-auto-medicine-scene-creator/ceed2107-502b-4ce0-9410-df357fb47fd2/scratchpad/${tag}${String(t).replace('.','_')}.png`})
  console.log('captured', t)
}
await b.close()
