import { AccumulativeShadows, Environment, Lightformer, RandomizedLight } from '@react-three/drei'

export interface LightingConfig {
  /** key light strength */
  key: number
  /** cool fill from camera-right */
  fill: number
  /** warm rim from behind the kiosk */
  rim: number
  /** image-based lighting strength */
  env: number
  /** contact shadow darkness */
  shadow: number
  /** how much scene light shapes the 2D actors: 0 = flat print, 1 = fully shaded */
  spriteLit: number
}

export const LIGHTING_DEFAULTS: LightingConfig = {
  key: 1.95,
  fill: 0.28,
  rim: 0.55,
  env: 0.2,
  shadow: 0.75,
  spriteLit: 0.55,
}

/**
 * White-cyclorama product lighting: a soft top key with a cool fill and a warm rim,
 * over a shadow-catching floor so the ground stays pure white and only the contact
 * shadow reads. The environment is built from lightformers, so nothing is fetched at
 * runtime and exports stay deterministic.
 */
export function StudioStage({ config }: { config?: Partial<LightingConfig> }) {
  const cfg = { ...LIGHTING_DEFAULTS, ...config }

  return (
    <>
      <Environment resolution={256} environmentIntensity={cfg.env}>
        <color attach="background" args={['#f2f4f8']} />
        {/* broad softbox overhead — the main highlight along the cabinet top */}
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 5, 1.5]} scale={[9, 5, 1]} rotation={[-Math.PI / 2.4, 0, 0]} />
        {/* wrap-around side panels keep the white shell from going grey */}
        <Lightformer form="rect" intensity={1.0} color="#dbe7ff" position={[-5, 2.4, 2]} scale={[5, 6, 1]} rotation={[0, Math.PI / 3, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#fff2e2" position={[5, 2.2, -1.5]} scale={[5, 6, 1]} rotation={[0, -Math.PI / 2.6, 0]} />
        {/* narrow strip behind the camera for the specular line down the screen bezel */}
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[1.5, 2.2, 6]} scale={[2, 4, 1]} />
        <Lightformer form="ring" intensity={0.5} color="#ffffff" position={[0, 1.2, -6]} scale={[6, 6, 1]} />
      </Environment>

      <hemisphereLight args={['#eaf1ff', '#e6e2db', 0.09]} />

      {/* key: high and camera-left, tight shadow frustum for a crisp contact */}
      <directionalLight
        castShadow
        position={[3.6, 3.6, 2.6]}
        intensity={cfg.key}
        color="#fff8f0"
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
        shadow-camera-left={-3.2}
        shadow-camera-right={3.2}
        shadow-camera-top={3.4}
        shadow-camera-bottom={-1.6}
      />
      {/* overhead light: its shadow is what actually grounds the cabinet */}
      <directionalLight
        castShadow
        position={[0.5, 7, 1.1]}
        intensity={0.9}
        color="#ffffff"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-2.2}
      />
      {/* cool fill opens up the shadow side without flattening the form */}
      <directionalLight position={[-4.5, 2.6, 2.4]} intensity={cfg.fill} color="#cfe0ff" />
      {/* warm rim separates the cabinet from the white background */}
      <spotLight position={[-2.2, 3.8, -3.4]} angle={0.9} penumbra={1} intensity={cfg.rim} color="#ffd9b0" distance={14} />

      {/* the cabinet carries its own contact pad, so no extra render target is needed here */}

      {/* one near-white floor that catches the cast shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        {/* deliberately below white: a blown-out floor clips and swallows the shadow */}
        <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
      </mesh>
      {/* grounding shadow: tight and dark at the base, soft further out */}

    </>
  )
}

export { AccumulativeShadows, RandomizedLight }
