import * as THREE from 'three';

export class Prop {
    constructor(type, textureLoader) {
        this.type = type; // 'bottle' or 'mug'
        this.textureLoader = textureLoader;
        this.isDestroyed = false;
        this.mesh = this.createMesh();
    }

    createMesh() {
        const textureUrl = this.type === 'bottle' ? 
            'assets/whiskey-bottle.webp.webp' : 
            'assets/beer-mug.webp.webp';
        
        const texture = this.textureLoader.load(textureUrl);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            side: THREE.DoubleSide
        });

        // Proportional sizing
        const size = this.type === 'bottle' ? 4 : 5;
        const geometry = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.userData.isProp = true;
        mesh.userData.prop = this;
        
        return mesh;
    }

    onShoot() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        
        const position = this.mesh.position.clone();
        this.mesh.visible = false;

        return { type: 'prop', position: position, propType: this.type };
    }

    reset() {
        this.isDestroyed = false;
        this.mesh.material.color.setHex(0xffffff);
        this.mesh.scale.set(1, 1, 1);
        this.mesh.visible = true;
    }
}