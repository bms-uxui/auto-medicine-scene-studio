import { chromium } from 'playwright'
const [port, scene, target, t] = process.argv.slice(2)
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport:{width:900,height:600} })
await p.goto(`http://localhost:${port}/`, {waitUntil:'networkidle'})
await p.waitForFunction(()=>window.__studio, null, {timeout:20000})
await p.evaluate((s)=>window.__studio.getState().setScene(s), scene)
await new Promise(r=>setTimeout(r,3000))
console.log(JSON.stringify(await p.evaluate(async ({target,t})=>{
  const s = window.__studio.getState()
  for (let x=0;x<t;x+=1/30) s.setTime(x)
  s.setTime(t)
  for (let i=0;i<70;i++) await new Promise(r=>requestAnimationFrame(r))
  const cam = window.__camObj
  const proj = (o)=>{ if(!o||!cam) return null
    o.updateWorldMatrix(true,false)
    const e=o.matrixWorld.elements
    const v = cam.position.clone().set(e[12],e[13],e[14])
    v.project(cam); return [+v.x.toFixed(3), +v.y.toFixed(3)] }
  const w = (o)=>{ if(!o) return null; const e=o.matrixWorld.elements; return [+e[12].toFixed(3),+e[13].toFixed(3),+e[14].toFixed(3)] }
  return { hasCam: !!cam, grip: proj(s.registry.get('patient:grip')), tgt: proj(s.registry.get(target)),
           gripW: w(s.registry.get('patient:grip')), tgtW: w(s.registry.get(target)) }
}, {target, t:Number(t)})))
await b.close()
