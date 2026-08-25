import { chromium } from 'playwright'
const [port, scene, t, ...ids] = process.argv.slice(2)
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport:{width:900,height:600} })
await p.goto(`http://localhost:${port}/`, {waitUntil:'networkidle'})
await p.waitForFunction(()=>window.__studio, null, {timeout:20000})
await p.evaluate((s)=>window.__studio.getState().setScene(s), scene)
await new Promise(r=>setTimeout(r,3000))
console.log(JSON.stringify(await p.evaluate(async ({t, ids})=>{
  const s = window.__studio.getState()
  for (let x=0;x<t;x+=1/30) s.setTime(x)
  s.setTime(t)
  for (let i=0;i<70;i++) await new Promise(r=>requestAnimationFrame(r))
  const w = (id)=>{ const o=s.registry.get(id); if(!o) return null; const e=o.matrixWorld.elements; return [+e[12].toFixed(4),+e[13].toFixed(4),+e[14].toFixed(4)] }
  const out={}; for (const id of ids) out[id]=w(id)
  for (const id of ids) { const o=s.registry.get(id); if(!o) continue
    const e=o.rotation; out[id+':rotW']=[+e.x.toFixed(4),+e.y.toFixed(4),+e.z.toFixed(4)] }
  const g=s.registry.get('patient:grip')
  if (g) { const q={x:0,y:0,z:0,w:1}; g.getWorldQuaternion(g.quaternion.clone()) ; }
  const gq = s.registry.get('patient:grip')
  if (gq) { const m = gq.matrixWorld.elements
    // basis vectors of the grip frame in world (columns), normalised
    const col=(i)=>{const v=[m[i*4],m[i*4+1],m[i*4+2]]; const n=Math.hypot(...v); return v.map(x=>+(x/n).toFixed(5))}
    out.basis = { x: col(0), y: col(1), z: col(2) } }
  return out
}, {t:Number(t), ids})))
await b.close()
