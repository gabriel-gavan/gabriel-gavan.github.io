import * as THREE from 'three';

/**
 * BossShader.js
 * Advanced emergence and distortion shaders for Omega-Class entities.
 */

export const BossShader = {
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xff0000) },
        emergence: { value: 0.0 }, // 0.0 = fully emerged, 1.0 = just starting
        distortion: { value: 1.0 },
        glitch: { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        uniform float emergence;
        uniform float distortion;
        
        void main() {
            vUv = uv;
            vPosition = position;
            
            vec3 pos = position;
            
            // Apply cheaper distortion based on emergence
            float d = distortion * emergence;
            if (d > 0.0) {
                // Simplified distortion: Sine waves instead of multiple noise hashes
                pos.x += sin(pos.y * 5.0 + time * 3.0) * d * 0.2;
                pos.y += cos(pos.x * 5.0 + time * 2.5) * d * 0.2;
                pos.z += sin(pos.z * 5.0 + time * 2.0) * d * 0.2;
            }
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float emergence;
        uniform float glitch;
        varying vec2 vUv;
        
        void main() {
            // Horizontal scanline based on emergence
            float scanline = sin(vUv.y * 50.0 + time * 8.0) * 0.5 + 0.5;
            
            // Discard pixels based on emergence to create a "building up" effect
            if (fract(vUv.y * 10.0 + time * 0.5) < emergence) {
               discard;
            }

            // Random glitch flashes - simplified
            float flash = (glitch > 0.5 && fract(sin(time * 20.0) * 437.5) > 0.9) ? 0.2 : 0.0;
            
            vec3 finalColor = color + vec3(scanline * 0.15) + vec3(flash);
            float alpha = 1.0 - emergence;
            
            gl_FragColor = vec4(finalColor, alpha);
        }
    `
};

export function createBossMaterial(color = 0xff0000) {
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(BossShader.uniforms),
        vertexShader: BossShader.vertexShader,
        fragmentShader: BossShader.fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}
