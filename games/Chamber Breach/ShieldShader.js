import * as THREE from 'three';

export const ShieldShader = {
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x00ffff) },
        opacity: { value: 0.2 },
        impactPos: { value: new THREE.Vector3(0, 0, 0) },
        impactStrength: { value: 0.0 },
        rippleSpeed: { value: 2.0 },
        rippleDensity: { value: 10.0 },
        isHighFrequency: { value: 0.0 }
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
            // Simplified shader for GPU performance
            float t = time;
            
            // Fresnel effect - keep this as it looks good
            float fresnel = pow(1.0 - abs(vNormal.z), 3.0);
            
            // Simplified grid
            float grid = step(0.98, fract(vUv.x * 40.0)) + step(0.98, fract(vUv.y * 40.0));
            
            // Simplified impact ripple
            float dist = distance(vPosition, impactPos);
            float ripple = 0.0;
            if (impactStrength > 0.01) {
                ripple = sin(dist * rippleDensity - t * rippleSpeed) * 0.5 + 0.5;
                ripple *= exp(-dist * 2.0) * impactStrength;
            }
            
            float finalAlpha = opacity + fresnel * 0.4 + ripple + grid * 0.15;
            vec3 finalColor = color + vec3(ripple * 0.4);
            
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
