import * as THREE from 'three';

const TERMINAL_RED = new THREE.Color(0xff0000);
const TERMINAL_WHITE = new THREE.Color(0xffffff);

export class DataTerminal {
    constructor(scene, position, loreEntry, onInteract, isTrapped = false) {
        this.scene = scene;
        this.position = position;
        this.loreEntry = loreEntry;
        this.onInteract = onInteract;
        this.isInteracted = false;
        this.isPlayerNear = false;
        
        this.isTrapped = isTrapped;
        this.isDisarmed = false;
        this.trapTriggered = false;
        
        this.group = new THREE.Group();
        this.group.position.copy(position);
        
        this.mesh = this.createMesh();
        this.group.add(this.mesh);
        
        this.scene.add(this.group);
        
        this.light = new THREE.PointLight(this.isTrapped ? 0xff3300 : 0x00d0ff, 1.5, 3);
        this.light.position.set(0, 1.2, 0.3);
        this.group.add(this.light);
    }

    createMesh() {
        const baseGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.6;
        
        const screenGeo = new THREE.BoxGeometry(0.6, 0.4, 0.05);
        const screenMat = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            emissive: this.isTrapped ? 0xff3300 : 0x00d0ff,
            emissiveIntensity: 0.5,
            metalness: 0.5,
            roughness: 0.1
        });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0, 0.3, 0.18);
        base.add(screen);
        
        return base;
    }

    update(dt, playerPos) {
        if (!playerPos) return;

        const dist = this.group.position.distanceTo(playerPos);
        this.isPlayerNear = dist < 2.5;

        const playerPerks = window.game?.player?.perks || {};
        const screen = this.mesh.children[0];
        const screenMat = screen && screen.material ? screen.material : null;

        if (this.isPlayerNear) {
            const pulseTime = Date.now() * 0.01;
            this.light.intensity = 2.5 + Math.sin(pulseTime) * 0.5;
            if (screenMat) screenMat.emissiveIntensity = 1.0 + Math.sin(pulseTime) * 0.2;
        } else {
            this.light.intensity = 1.0;
            if (screenMat) screenMat.emissiveIntensity = 0.5;
        }

        if (this.isTrapped && !this.isDisarmed && playerPerks.trapSniffer) {
            const snifferPulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
            this.light.color.lerp(TERMINAL_RED, 0.05);
            this.light.intensity += snifferPulse * 2.0;
        }

        if (this.isTrapped && !this.isDisarmed && Math.random() < 0.05) {
            this.light.intensity = 0.5 + Math.random() * 2;
            if (screenMat) screenMat.emissiveIntensity = 0.2 + Math.random() * 0.8;
        }
    }

    disarm() {
        if (!this.isTrapped || this.isDisarmed) return;
        this.isDisarmed = true;
        const successColor = 0x00ffaa;
        const screen = this.mesh.children[0];
        const screenMat = screen && screen.material ? screen.material : null;
        this.light.color.set(successColor);
        if (screenMat) {
            screenMat.color.set(0x111111);
            screenMat.emissive.set(successColor);
        }
    }

    interact() {
        if (this.isInteracted) return;
        
        const playerPerks = window.game?.player?.perks || {};

        if (this.isTrapped && !this.isDisarmed && !this.trapTriggered) {
            if (playerPerks.trapSniffer && Math.random() < 0.5) {
                this.disarm();
                if (window.game && window.game.playArbiterSound) {
                    window.game.playArbiterSound('perk', { type: 'sniffer' });
                }
                if (this.onInteract) this.onInteract(this.loreEntry, false);
                return;
            }

            this.trapTriggered = true;
            this.light.color.set(0xff0000);
            this.light.intensity = 10;
            if (this.onInteract) {
                this.onInteract(this.loreEntry, true);
            }
            return;
        }

        if (this.onInteract) {
            this.onInteract(this.loreEntry, false);
        }
        
        const originalColor = this.light.color.clone();
        this.light.color.copy(TERMINAL_WHITE);
        setTimeout(() => this.light.color.copy(originalColor), 200);
    }

    destroy() {
        this.scene.remove(this.group);
    }
}
