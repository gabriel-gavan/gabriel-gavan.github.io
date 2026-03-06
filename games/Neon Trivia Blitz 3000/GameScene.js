import * as THREE from 'three';
import { CONFIG } from './config.js';

export class GameScene {
    constructor(container) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.COLORS.BACKGROUND);
        this.scene.fog = new THREE.Fog(CONFIG.COLORS.BACKGROUND, 10, 50);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 12);
        this.camera.lookAt(0, 2, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        this.initLighting();
        this.initStage();
        this.initEnvironment();

        window.addEventListener('resize', () => this.onWindowResize());
        this.targetCameraPos = new THREE.Vector3(0, 5, 12);
        this.targetCameraLookAt = new THREE.Vector3(0, 2, 0);
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(5, 10, 7);
        this.scene.add(this.directionalLight);

        // Stage spotlights
        this.spotlights = [];
        const colors = [CONFIG.COLORS.PRIMARY, CONFIG.COLORS.SECONDARY, CONFIG.COLORS.ACCENT];
        for (let i = 0; i < 3; i++) {
            const spot = new THREE.SpotLight(colors[i], 200);
            spot.position.set(Math.cos(i * 2) * 5, 10, Math.sin(i * 2) * 5);
            spot.angle = Math.PI / 6;
            spot.penumbra = 0.3;
            spot.decay = 2;
            spot.distance = 50;
            spot.target.position.set(0, 0, 0);
            this.scene.add(spot);
            this.scene.add(spot.target);
            this.spotlights.push(spot);
        }
    }

    initStage() {
        // Load background texture
        const loader = new THREE.TextureLoader();
        const bgTexture = loader.load('assets/trivia-background.png.webp');

        // Main floor
        const floorGeo = new THREE.CircleGeometry(10, 64);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: CONFIG.COLORS.STAGE_FLOOR, 
            roughness: 0.1, 
            metalness: 0.8 
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Neon ring around stage
        const ringGeo = new THREE.TorusGeometry(10, 0.1, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.PRIMARY });
        this.neonRing = new THREE.Mesh(ringGeo, ringMat);
        this.neonRing.rotation.x = Math.PI / 2;
        this.scene.add(this.neonRing);

        // Backdrop screen
        const screenGeo = new THREE.PlaneGeometry(16, 9);
        this.screenMat = new THREE.MeshBasicMaterial({ 
            map: bgTexture,
            color: 0x888888, // Slightly tinted
            side: THREE.DoubleSide
        });
        this.screen = new THREE.Mesh(screenGeo, this.screenMat);
        this.screen.position.set(0, 5, -8);
        this.scene.add(this.screen);

        // Screen border
        const borderGeo = new THREE.BoxGeometry(16.5, 9.5, 0.2);
        const borderMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(0, 5, -8.2);
        this.scene.add(border);

        // Stage podiums
        const podiumGeo = new THREE.CylinderGeometry(1.5, 2, 1, 32);
        const podiumMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        this.podium = new THREE.Mesh(podiumGeo, podiumMat);
        this.podium.position.set(0, 0.5, 2);
        this.scene.add(this.podium);
    }

    initEnvironment() {
        // Floating decorative cubes
        this.cubes = [];
        const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 20; i++) {
            const cubeMat = new THREE.MeshStandardMaterial({ 
                color: Math.random() > 0.5 ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.SECONDARY,
                transparent: true,
                opacity: 0.4
            });
            const cube = new THREE.Mesh(cubeGeo, cubeMat);
            cube.position.set(
                (Math.random() - 0.5) * 40,
                Math.random() * 20,
                (Math.random() - 0.5) * 40
            );
            cube.rotation.set(Math.random(), Math.random(), Math.random());
            this.scene.add(cube);
            this.cubes.push(cube);
        }
    }

    flashScreen(color) {
        const originalColor = new THREE.Color(0x111111);
        this.screenMat.color.set(color);
        setTimeout(() => {
            this.screenMat.color.set(originalColor);
        }, 300);
    }

    setStageColor(color) {
        this.neonRing.material.color.set(color);
        this.spotlights.forEach(spot => spot.color.set(color));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    update(time) {
        // Gentle camera movement
        this.camera.position.lerp(this.targetCameraPos, 0.05);
        
        // Cube animation
        this.cubes.forEach((cube, i) => {
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            cube.position.y += Math.sin(time * 0.001 + i) * 0.01;
        });

        // Pulsing neon ring
        const pulse = 0.8 + Math.sin(time * 0.003) * 0.2;
        this.neonRing.scale.set(pulse, pulse, pulse);

        this.renderer.render(this.scene, this.camera);
    }

    zoomToScreen() {
        this.targetCameraPos.set(0, 5, 5);
    }

    resetCamera() {
        this.targetCameraPos.set(0, 5, 12);
    }
}
