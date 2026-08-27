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
  key: 1.25,
  fill: 0.35,
  rim: 0.32,
  env: 0.62,
  shadow: 0.75,
  spriteLit: 1,
}

/**
 * Daylight in a room, not a product shot on a cyclorama.
 *
 * The old rig was built for an infinite white floor: almost no image-based light, one hard
 * key doing nearly all the work, and a warm rim whose only job was to peel the cabinet off
 * a white background. Once the kiosk was standing in a room that read as flat and lifeless
 * — surfaces with no bounce in them, a wall lit by nothing, and shadows with a hard edge
 * the size of the machine.
 *
 * What is here instead is the light the reference has: a big soft window off to the left of
 * camera as the key, a broad overhead as the room's own ceiling, and warm bounce coming
 * back up off the wood floor. Most of the illumination is now image-based, which is what
 * gives curved and recessed surfaces their gradient — a directional light alone cannot.
 *
 * It is still built from lightformers rather than an HDRI: nothing is fetched at runtime
 * and the exports stay deterministic.
 */
export function StudioStage({ config }: { config?: Partial<LightingConfig> }) {
  const cfg = { ...LIGHTING_DEFAULTS, ...config }

  return (
    <>
      <Environment resolution={512} environmentIntensity={cfg.env}>
        {/* the room's own value, which is what fills the shadows */}
        <color attach="background" args={['#e9eef2']} />
        {/* the window: tall, warm and off to camera-left — the source everything is keyed to */}
        <Lightformer form="rect" intensity={3.4} color="#fff1dc" position={[-4.2, 2.2, 3.4]} scale={[4.5, 4.5, 1]} rotation={[0, Math.PI / 3.4, 0]} />
        {/* a second, dimmer pane further back so the falloff along the wall is not linear */}
        <Lightformer form="rect" intensity={1.5} color="#ffeed6" position={[-5, 2.1, -0.6]} scale={[3, 4, 1]} rotation={[0, Math.PI / 2, 0]} />
        {/* the ceiling: broad and neutral, the room's ambient */}
        <Lightformer form="rect" intensity={1.15} color="#ffffff" position={[0, 5.2, 0.6]} scale={[11, 8, 1]} rotation={[-Math.PI / 2, 0, 0]} />
        {/* and the floor throwing warmth back up — pale wood under a lit room does this */}
        <Lightformer form="rect" intensity={0.5} color="#f7e3c6" position={[0, -0.6, 1.2]} scale={[10, 8, 1]} rotation={[Math.PI / 2, 0, 0]} />
        {/* a cool panel behind the camera keeps the shadow side from going brown */}
        <Lightformer form="rect" intensity={0.7} color="#e8f0ff" position={[2.5, 2, 6]} scale={[4, 4, 1]} />
      </Environment>

      {/* sky and the bounce off a warm floor, which the environment alone under-reads */}
      <hemisphereLight args={['#fdf3e6', '#f0e2cc', 0.28]} />

      {/*
        The sun through that window. One shadow caster, not two: two of them crossed the
        cabinet with a second shadow at a different angle, which is the thing that reads as
        studio lighting more than anything else.
      */}
      <directionalLight
        castShadow
        position={[-4.4, 4.6, 3.2]}
        intensity={cfg.key}
        color="#fff4e4"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={4}
        shadow-camera-near={0.5}
        shadow-camera-far={22}
        shadow-camera-left={-5.5}
        shadow-camera-right={5.5}
        shadow-camera-top={4.2}
        shadow-camera-bottom={-1.6}
      />
      {/* the ceiling as a light rather than only as an image: it is what lifts the tops */}
      <directionalLight position={[0.6, 7, 1.4]} intensity={0.34} color="#fffaf2" />
      {/* fill from camera-right, cool, opening the shadow side without flattening it */}
      <directionalLight position={[4.6, 2.4, 3.2]} intensity={cfg.fill} color="#dceaff" />
      {/*
        And a soft one from the camera itself. The pick-up bay is a deep recess facing the
        lens: keyed from a window off to the left, no light reaches inside it at all and the
        insert that the whole grab is played in came out nearly black. This is the bounce a
        real room has coming off everything behind the camera.
      */}
      <directionalLight position={[0.6, 1.6, 6]} intensity={0.5} color="#fff6ea" />
      {/* a little separation on the cabinet's right shoulder, where the wall goes white */}
      <spotLight position={[3.4, 3.6, -2.2]} angle={1.0} penumbra={1} intensity={cfg.rim} color="#ffe8cc" distance={16} />

      {/*
        The white floor stays, a millimetre and a half under the room's boards. It is what
        the demonstrations stand on once the room has dissolved, and it is what the contact
        shadows were tuned against.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
      </mesh>
    </>
  )
}

export { AccumulativeShadows, RandomizedLight }
