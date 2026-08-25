import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport:{width:900,height:600} })
await p.goto('http://localhost:5175/', {waitUntil:'networkidle'})
await p.waitForFunction(()=>window.__studio, null, {timeout:20000})
await p.evaluate(()=>window.__studio.getState().setScene('patient-collect-opd'))
await new Promise(r=>setTimeout(r,3000))
console.log(JSON.stringify(await p.evaluate(async ()=>{
  const s = window.__studio.getState()
  for (let x=0;x<4.2;x+=1/30) s.setTime(x)
  s.setTime(4.2)
  for (let i=0;i<60;i++) await new Promise(r=>requestAnimationFrame(r))
  const sc = s.scenes.find(x=>x.id===s.sceneId)
  const kiosk = s.registry.get('kiosk')
  const pat = s.registry.get('patient')
  const THREE = window.__three
  const box = (o)=>{ if(!o) return null
    let min=[1e9,1e9,1e9], max=[-1e9,-1e9,-1e9]
    o.updateWorldMatrix(true,true)
    o.traverse((c)=>{ const g=c.geometry; if(!g||!c.visible) return; g.computeBoundingBox()
      const bb=g.boundingBox.clone(); bb.applyMatrix4(c.matrixWorld)
      min=[Math.min(min[0],bb.min.x),Math.min(min[1],bb.min.y),Math.min(min[2],bb.min.z)]
      max=[Math.max(max[0],bb.max.x),Math.max(max[1],bb.max.y),Math.max(max[2],bb.max.z)] })
    return { min: min.map(v=>+v.toFixed(3)), max: max.map(v=>+v.toFixed(3)) } }
  
  // the cabinet body only: the widest mesh at the front, ignoring the open door
  let faceZ = -1e9
  kiosk.traverse((c)=>{ if(!c.geometry||!c.visible) return; c.geometry.computeBoundingBox()
    const bb=c.geometry.boundingBox.clone(); bb.applyMatrix4(c.matrixWorld)
    const w = bb.max.x-bb.min.x, h = bb.max.y-bb.min.y
    if (w > 0.8 && h > 0.8) faceZ = Math.max(faceZ, bb.max.z) })
  const parts=[]
  pat.traverse((c)=>{ const g=c.geometry; if(!g||!c.visible) return; g.computeBoundingBox()
    const bb=g.boundingBox.clone(); bb.applyMatrix4(c.matrixWorld)
    parts.push({ n: c.name || c.type, z:[+bb.min.z.toFixed(3), +bb.max.z.toFixed(3)], y:[+bb.min.y.toFixed(2),+bb.max.y.toFixed(2)] }) })
  return { faceZ: +faceZ.toFixed(3), parts }
})))
await b.close()
