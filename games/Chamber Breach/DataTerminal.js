import * as THREE from 'three';

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
        
        // Light source for the terminal
        this.light = new THREE.PointLight(this.isTrapped ? 0xff3300 : 0x00d0ff, 1.5, 3);
        this.light.position.set(0, 1.2, 0.3);
        this.group.add(this.light);
    }

    createMesh() {
        const baseGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.6;
        
        // Use a small emissive "screen" that is part of the physical mesh rather than a floating plane
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
        const dist = this.group.position.distanceTo(playerPos);
        this.isPlayerNear = dist < 2.5;

        const playerPerks = window.game?.player?.perks || {};

        // Visual feedback for proximity via light intensity
        if (this.isPlayerNear) {
            this.light.intensity = 2.5 + Math.sin(Date.now() * 0.01) * 0.5;
            this.mesh.children[0].material.emissiveIntensity = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;
        } else {
            this.light.intensity = 1.0;
            this.mesh.children[0].material.emissiveIntensity = 0.5;
        }

        // Sniffer effect: distinct red pulse for traps if near
        if (this.isTrapped && !this.isDisarmed && playerPerks.trapSniffer) {
            const snifferPulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
            this.light.color.lerp(new THREE.Color(0xff0000), 0.05);
            this.light.intensity += snifferPulse * 2.0;
        }

        // Corrupted flicker for trapped terminals
        if (this.isTrapped && !this.isDisarmed && Math.random() < 0.05) {
            this.light.intensity = 0.5 + Math.random() * 2;
            this.mesh.children[0].material.emissiveIntensity = 0.2 + Math.random() * 0.8;
        }
    }

    disarm() {
        if (!this.isTrapped || this.isDisarmed) return;
        this.isDisarmed = true;
        const successColor = 0x00ffaa;
        this.light.color.set(successColor); // Green for disarmed
        this.mesh.children[0].material.color.set(0x111111);
        this.mesh.children[0].material.emissive.set(successColor);
        console.log("TERMINAL TRAP NEUTRALIZED");
    }

    interact() {
        if (this.isInteracted) return;
        
        const playerPerks = window.game?.player?.perks || {};

        if (this.isTrapped && !this.isDisarmed && !this.trapTriggered) {
            // Neural Sniffer auto-disarm chance (50%)
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
            // The GameScene should handle the actual trap effect (spawning enemies etc)
            if (this.onInteract) {
                this.onInteract(this.loreEntry, true); // True means trap triggered
            }
            return;
        }

        if (this.onInteract) {
            this.onInteract(this.loreEntry, false);
        }
        
        // Visual feedback for interaction
        const originalColor = this.light.color.clone();
        this.light.color.set(0xffffff);
        setTimeout(() => this.light.color.copy(originalColor), 200);
    }

    destroy() {
        this.scene.remove(this.group);
    }
}
