import * as THREE from 'three';

export const ShieldShader = {
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x00ffff) },
        opacity: { value: 0.2 },
        impactPos: { value: new THREE.Vector3(0, 0, 0) },
        impactStrength: { value: 0.0 },
        rippleSpeed: { value: 2.0 },
        rippleDensity: { value: 10.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        uniform vec3 impactPos;
        uniform float impactStrength;
        uniform float rippleSpeed;
        uniform float rippleDensity;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
            // Base hex grid-like wireframe effect using UVs
            float grid = sin(vUv.x * 50.0) * sin(vUv.y * 50.0);
            grid = step(0.9, grid);
            
            // Fresnel effect
            float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            
            // Pulsing scanline
            float scanline = sin(vPosition.y * 10.0 + time * 5.0) * 0.5 + 0.5;
            scanline = pow(scanline, 10.0) * 0.2;
            
            // Impact ripple
            float dist = distance(vPosition, impactPos);
            float ripple = sin(dist * rippleDensity - time * rippleSpeed) * 0.5 + 0.5;
            ripple *= exp(-dist * 2.0) * impactStrength;
            
            float finalAlpha = opacity + fresnel * 0.5 + scanline + ripple + grid * 0.1;
            
            vec3 finalColor = color + vec3(ripple * 0.5);
            
            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `
};

export function createShieldMaterial(color = 0x00ffff, opacity = 0.2) {
    const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(ShieldShader.uniforms),
        vertexShader: ShieldShader.vertexShader,
        fragmentShader: ShieldShader.fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    material.uniforms.color.value.set(color);
    material.uniforms.opacity.value = opacity;
    
    return material;
}
