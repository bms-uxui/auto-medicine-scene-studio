import { useEffect, useState } from 'react'
import { Studio } from './studio/Studio'
import { ModelLab } from './lab/ModelLab'
import { StaffLab } from './lab/StaffLab'
import { Gallery } from './gallery/Gallery'

type Route = 'studio' | 'lab' | 'staff' | 'gallery'

function currentRoute(): Route {
  // the hash can carry a query (`#/lab?door=1`), so only the path part selects the route
  const hash = location.hash.replace('#/', '').split('?')[0]
  if (hash === 'lab') return 'lab'
  if (hash === 'staff') return 'staff'
  if (hash === 'gallery') return 'gallery'
  return 'studio'
}

/**
 * Four pages: the scene studio (timeline), the kiosk model lab, the staff lab, and the
 * visitor gallery that plays and hands out whatever has been rendered into `out/`.
 */
export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === 'lab') return <ModelLab />
  if (route === 'staff') return <StaffLab />
  if (route === 'gallery') return <Gallery />
  return <Studio />
}
