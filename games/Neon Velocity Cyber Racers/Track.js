import * as THREE from 'three';
import { Config } from './Config.js';
import { CampaignData } from './CampaignData.js';

export class Track {
    constructor(scene, trackIndex = 0) {
        this.scene = scene;
        this.trackIndex = trackIndex;
        
        this.trackInfo = CampaignData.tracks[trackIndex] || CampaignData.tracks[0];
        this.waypoints = this.trackInfo.waypoints;

        this.boostPads = [];
        this.oilSlicks = [];
        this.meshGroup = new THREE.Group();
        this.scene.add(this.meshGroup);
        
        this.init();
    }

    destroy() {
        this.scene.remove(this.meshGroup);
        this.meshGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
        this.boostPads = [];
        this.oilSlicks = [];
    }

    init() {
        // Create the road using a CatmullRomCurve3
        this.curve = new THREE.CatmullRomCurve3(this.waypoints, true);
        const trackGeometry = new THREE.TubeGeometry(this.curve, 200, Config.TRACK_WIDTH, 8, true);
        const texture = new THREE.TextureLoader().load(Config.ASSETS.ROAD);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(40, 1);

        const trackMaterial = new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 0.1,
            metalness: 0.9,
            emissive: this.trackInfo.roadColor,
            emissiveIntensity: 0.2
        });

        const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        trackMesh.position.y = -Config.TRACK_WIDTH + 0.5; // Flatten it slightly
        trackMesh.scale.y = 0.1;
        this.meshGroup.add(trackMesh);

        // Add visual side lines (Glowing borders)
        const borderMat = new THREE.MeshStandardMaterial({ 
            color: this.trackInfo.accentColor, 
            emissive: this.trackInfo.accentColor, 
            emissiveIntensity: 5,
            transparent: true,
            opacity: 0.8
        });

        // Left and Right Border Lines
        const borderPointsL = [];
        const borderPointsR = [];
        const divisions = 200;
        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const p = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            borderPointsL.push(p.clone().add(normal.clone().multiplyScalar(Config.TRACK_WIDTH)));
            borderPointsR.push(p.clone().add(normal.clone().multiplyScalar(-Config.TRACK_WIDTH)));
        }

        const borderCurveL = new THREE.CatmullRomCurve3(borderPointsL);
        const borderCurveR = new THREE.CatmullRomCurve3(borderPointsR);
        
        // Thinner core glow lines
        const borderGeoL = new THREE.TubeGeometry(borderCurveL, divisions, 0.2, 8, true);
        const borderGeoR = new THREE.TubeGeometry(borderCurveR, divisions, 0.2, 8, true);

        this.meshGroup.add(new THREE.Mesh(borderGeoL, borderMat));
        this.meshGroup.add(new THREE.Mesh(borderGeoR, borderMat));

        // BEAUTIFUL ROAD EDGES: Floating Neon Orbs and Holographic Ribbons
        const orbGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({ 
            color: this.trackInfo.accentColor, 
            emissive: this.trackInfo.accentColor, 
            emissiveIntensity: 5,
            transparent: true,
            opacity: 0.9
        });

        const rippleDivisions = 80;
        for (let i = 0; i < rippleDivisions; i++) {
            const t = i / rippleDivisions;
            const pL = borderCurveL.getPoint(t);
            const pR = borderCurveR.getPoint(t);
            
            // Floating orbs that "pulse"
            const orbL = new THREE.Mesh(orbGeo, orbMat);
            orbL.position.copy(pL);
            orbL.position.y = 1.5 + Math.sin(t * 20) * 0.5;
            this.meshGroup.add(orbL);

            const orbR = new THREE.Mesh(orbGeo, orbMat);
            orbR.position.copy(pR);
            orbR.position.y = 1.5 + Math.sin(t * 20 + Math.PI) * 0.5;
            this.meshGroup.add(orbR);

            // Connect orbs with a thin holographic "ribbon" (continuous thin line)
            if (i < rippleDivisions - 1) {
                const nextT = (i + 1) / rippleDivisions;
                const pL_next = borderCurveL.getPoint(nextT);
                const pR_next = borderCurveR.getPoint(nextT);

                // Thin glowing lines connecting orbs
                const lineL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, pL.distanceTo(pL_next)), orbMat);
                lineL.position.copy(pL.clone().lerp(pL_next, 0.5));
                lineL.position.y = 1.5 + Math.sin(t * 20) * 0.5;
                lineL.lookAt(pL_next);
                this.meshGroup.add(lineL);

                const lineR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, pR.distanceTo(pR_next)), orbMat);
                lineR.position.copy(pR.clone().lerp(pR_next, 0.5));
                lineR.position.y = 1.5 + Math.sin(t * 20 + Math.PI) * 0.5;
                lineR.lookAt(pR_next);
                this.meshGroup.add(lineR);
            }
        }

        // Add Decorative Scenery (Buildings, lamps)
        this.addScenery(this.curve);

        // Place Finish Line
        const finishLineGeo = new THREE.PlaneGeometry(Config.TRACK_WIDTH * 2, 8);
        const finishLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
        finishLine.rotation.x = -Math.PI / 2;
        
        const startPoint = this.waypoints[0];
        const nextPoint = this.waypoints[1];
        const startDir = nextPoint.clone().sub(startPoint).normalize();
        finishLine.rotation.z = Math.atan2(startDir.x, startDir.z);

        finishLine.position.copy(startPoint);
        finishLine.position.y = 0.1;
        this.meshGroup.add(finishLine);

        // Hazards and Boosts
        this.addHazards(this.curve);
    }

    addScenery(curve) {
        const divisions = 40;
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2 });
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });

        for (let i = 0; i < divisions; i++) {
            const t = i / divisions;
            const p = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            // Street Lamps every few divisions
            if (i % 2 === 0) {
                const side = (i % 4 === 0) ? 1 : -1;
                const lampPos = p.clone().add(normal.clone().multiplyScalar((Config.TRACK_WIDTH + 5) * side));
                
                // Pole
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10), poleMat);
                pole.position.copy(lampPos);
                pole.position.y = 5;
                this.meshGroup.add(pole);

                // Lamp head
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.8), lampMat);
                head.position.copy(lampPos);
                head.position.y = 10;
                this.meshGroup.add(head);

                // Small light
                const light = new THREE.PointLight(0x00ffff, 20, 30);
                light.position.copy(head.position);
                this.meshGroup.add(light);
            }

            // Random Buildings further out
            if (i % 5 === 0) {
                const side = (Math.random() > 0.5) ? 1 : -1;
                const bPos = p.clone().add(normal.clone().multiplyScalar((Config.TRACK_WIDTH + 30 + Math.random() * 40) * side));
                const h = 20 + Math.random() * 80;
                const w = 15 + Math.random() * 20;
                const bGeo = new THREE.BoxGeometry(w, h, w);
                const building = new THREE.Mesh(bGeo, buildingMat);
                building.position.copy(bPos);
                building.position.y = h / 2;
                this.meshGroup.add(building);

                // Add some neon window lines
                const lineGeo = new THREE.BoxGeometry(w + 0.2, 0.5, w + 0.2);
                const lineMat = new THREE.MeshBasicMaterial({ color: (Math.random() > 0.5 ? 0x00ffff : 0xff00ff) });
                for (let j = 0; j < 5; j++) {
                    const line = new THREE.Mesh(lineGeo, lineMat);
                    line.position.copy(bPos);
                    line.position.y = (h / 5) * j + (Math.random() * 5);
                    this.meshGroup.add(line);
                }
            }
        }
    }

    addHazards(curve) {
        const hazardCount = 15;
        for (let i = 1; i < hazardCount; i++) {
            const t = i / hazardCount;
            const pos = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            // Random offset from center
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            const offset = (Math.random() - 0.5) * (Config.TRACK_WIDTH * 1.2);
            pos.add(normal.multiplyScalar(offset));

            if (i % 2 === 0) {
                this.createBoostPad(pos, tangent);
            } else {
                this.createOilSlick(pos, tangent);
            }
        }
    }

    createBoostPad(pos, tangent) {
        const geo = new THREE.PlaneGeometry(8, 8);
        const texture = new THREE.TextureLoader().load(Config.ASSETS.BOOST);
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const pad = new THREE.Mesh(geo, mat);
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = Math.atan2(tangent.x, tangent.z);
        pad.position.copy(pos);
        pad.position.y = 0.15;
        this.meshGroup.add(pad);
        this.boostPads.push(pad);
    }

    createOilSlick(pos, tangent) {
        const geo = new THREE.PlaneGeometry(8, 8);
        const texture = new THREE.TextureLoader().load(Config.ASSETS.OIL);
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const slick = new THREE.Mesh(geo, mat);
        slick.rotation.x = -Math.PI / 2;
        slick.position.copy(pos);
        slick.position.y = 0.15;
        this.meshGroup.add(slick);
        this.oilSlicks.push(slick);
    }

    checkCollisions(car) {
        const carPos = car.mesh.position;

        // Boundary Check: Keep car inside the neon lines
        let nearestT = 0;
        let minDist = Infinity;
        for (let i = 0; i <= 100; i++) {
            const p = this.curve.getPoint(i / 100);
            const d = p.distanceTo(carPos);
            if (d < minDist) {
                minDist = d;
                nearestT = i / 100;
            }
        }
        
        const closestPoint = this.curve.getPoint(nearestT);
        const distanceToCenter = carPos.distanceTo(closestPoint);

        if (distanceToCenter > Config.TRACK_WIDTH - 1.5) {
            const pushDir = closestPoint.clone().sub(carPos).normalize();
            pushDir.y = 0;
            car.mesh.position.add(pushDir.multiplyScalar(0.8));
            car.speed *= 0.8;
        }
        
        // Boost pads
        this.boostPads.forEach(pad => {
            if (carPos.distanceTo(pad.position) < 5) {
                if (!car.isBoosting) car.applyBoost();
            }
        });

        // Oil slicks
        this.oilSlicks.forEach(slick => {
            if (carPos.distanceTo(slick.position) < 4) {
                if (!car.isSlipping) car.applyOil();
            }
        });

        // Lap detection (Finish line at waypoint 0)
        const distToStart = carPos.distanceTo(this.waypoints[0]);
        if (distToStart < 10) {
            if (car.checkpointReached) {
                car.lap++;
                car.checkpointReached = false;
                console.log(`${car.isPlayer ? 'Player' : 'AI'} Lap: ${car.lap}`);
            }
        }

        // Checkpoint detection (Middle of the track)
        const distToMid = carPos.distanceTo(this.waypoints[Math.floor(this.waypoints.length / 2)]);
        if (distToMid < 20) {
            car.checkpointReached = true;
        }
    }
}
