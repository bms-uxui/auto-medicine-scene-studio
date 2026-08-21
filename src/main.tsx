import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: its dev-only double-mount tears down and rebuilds the WebGL
// context, which shows up as "Context Lost" and leaves the post-processing
// composer holding a dead renderer.
createRoot(document.getElementById('root')!).render(<App />)
