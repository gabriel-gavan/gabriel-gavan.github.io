export default function initGame(
    THREE,
    GLTFLoader,
    EffectComposer,
    RenderPass,
    UnrealBloomPass
) {

    // ============================================================
    // 🔥 GLOBALS
    // ============================================================
    let scene, camera, renderer, composer;
    let player, playerMixer, runAction;
    let obstacles = [];
    let score = 0;
    let distance = 0;
    let difficulty = 1;
    let gameRunning = true;
	let actions = {};
	let holeTexture;
	let currentAction = null;
	let laneLines;
	let animArms = [];
	let animLegs = [];
	let useProceduralRun = false;
	let runTime = 0;
    let lane = 0;
    let targetX = 0;
    let isJumping = false;
    let yVelocity = 0;
    const gravity = -0.010;
	let laneSwitching = false;
	let laneSwitchStart = 0;
    let shield = false;
    let shieldTimer = 0;
	let ROAD_WIDTH =20
    let sJump, sHit, sPower;
	let coins = 0;
    let coinRotationSpeed = 0.08;
    const clock = new THREE.Clock();
	let coinTex;
    //let road1, road2, road3;
	const speed = 0.30 * difficulty;
	let playerFalling = false;
	let fallVelocity = 0;
	let roadSegments = [];
	const SEG_LENGTH = 5;
		const SEG_COUNT = 40;
		const ROAD_SPAN = SEG_LENGTH * SEG_COUNT; 
	function hideGameOver() {
		const screen = document.getElementById("gameOverScreen");
		screen.style.display = "none";
		screen.classList.remove("show");
	}
    // ============================================================
    // INIT
    // ============================================================
    function init() {
		
        scene = new THREE.Scene();
		laneLines = createLaneLines();
        // --- TEXTURES ---
        const texLoader = new THREE.TextureLoader();
		holeTexture = texLoader.load("textures/hole.webp");
		holeTexture.flipY = false;
        const skyTex = texLoader.load("textures/sky_neon.jpg");
        const roadTex = texLoader.load("textures/road.jpg");
		coinTex = texLoader.load("textures/coin.webp");
		coinTex.flipY = false;
		
        scene.background = skyTex;
		const glowLight = new THREE.PointLight(0xff3300, 2, 20);
		glowLight.position.set(0, 2, 0);
		scene.add(glowLight);
        roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
        roadTex.repeat.set(1, 1);
		
				// --- SEGMENTED INFINITE ROAD ---
		// build many small slices so we can remove one to make a real hole
		
		const roadMat = new THREE.MeshStandardMaterial({ map: roadTex });

		// Split each segment into 3 lanes
		const segLength = SEG_LENGTH;
		const laneWidth = ROAD_WIDTH / 3;

		for (let i = 0; i < 40; i++) {
			for (let lane = 0; lane < 3; lane++) {

				const segGeo = new THREE.PlaneGeometry(laneWidth, segLength);
				const seg = new THREE.Mesh(segGeo, roadMat);

				seg.rotation.x = -Math.PI / 2;

				// Lane positions: -LANE_WIDTH, 0, +LANE_WIDTH
				const xLane =
					lane === 0 ? -laneWidth :
					lane === 1 ? 0 :
					laneWidth;

				seg.position.set(xLane, 0, -i * segLength);

				seg.userData.type = "road";
				seg.userData.lane = lane;  // 0, 1, 2

				scene.add(seg);
				roadSegments.push(seg);
			}
		}
        // --- SOUNDS ---
        sJump = new Audio("sounds/jump.wav");
        sHit = new Audio("sounds/hit.wav");
        sPower = new Audio("sounds/powerup.wav");

        // --- CAMERA ---
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        camera.position.set(0, 3, 6);

        // --- RENDERER ---
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("gameContainer").appendChild(renderer.domElement);

        // --- BLOOM ---
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.0, 0.4, 0.85
        );
        composer.addPass(bloomPass);

        // --- LIGHTS ---
        scene.add(new THREE.AmbientLight(0xffffff, 0.45));
        const dLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dLight.position.set(4, 10, 4);
        scene.add(dLight);


        // --- CONTROLS ---
        setupControls();

        // --- PLAYER ---
        loadPlayer();

        window.addEventListener("resize", onResize);
    }
	
	function spawnCoin() {
		const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 20);
		const mat = new THREE.MeshStandardMaterial({
			map: coinTex,
			emissive: 0xffd700,
			emissiveIntensity: 1
		});

		const coin = new THREE.Mesh(geo, mat);
		coin.rotation.x = Math.PI / 2;
		coin.userData.type = "coin";

		const laneWidth = ROAD_WIDTH / 3;
		const lanes = [-laneWidth, 0, laneWidth];

		coin.position.set(
			lanes[Math.floor(Math.random() * 3)],
			0.6,
			-35
		);

		scene.add(coin);
		obstacles.push(coin);
	}
	function createLaneLines() {
		const lineMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffff,      // neon aqua
			linewidth: 2
		});

		const pointsLeft = [];
		const pointsRight = [];

		// Draw long lines far enough so you never see the end
		for (let z = -500; z < 200; z += 1) {
			const laneWidth = 20 / 3;

			pointsLeft.push(new THREE.Vector3(-laneWidth / 2, 0.02, z));
			pointsRight.push(new THREE.Vector3(laneWidth / 2, 0.02, z));
		}

		const geometryLeft = new THREE.BufferGeometry().setFromPoints(pointsLeft);
		const geometryRight = new THREE.BufferGeometry().setFromPoints(pointsRight);

		const leftLine = new THREE.Line(geometryLeft, lineMaterial);
		const rightLine = new THREE.Line(geometryRight, lineMaterial);

		scene.add(leftLine);
		scene.add(rightLine);

		return { leftLine, rightLine };
	}
    // ============================================================
    // PLAYER LOADING
    // ============================================================
    function loadPlayer() {
		const loader = new GLTFLoader();

		loader.load("models/a_soldier_mercenary_with_helmet_and_yellow_visor.glb", gltf => {

			console.log("Clips:", gltf.animations.map(a => a.name));

			player = gltf.scene;
			player.scale.set(0.015, 0.015, 0.015);   
			player.position.y = 0;
			player.position.set(0, 0.05, 0);
			scene.add(player);
			player.rotation.y = Math.PI;

			console.log("Animation clips:");
			gltf.animations.forEach(a => console.log("•", a.name));

			// --- MIXER ---
			playerMixer = new THREE.AnimationMixer(player);

			// --- STORE ALL ACTIONS ---
			actions = {};
			gltf.animations.forEach(clip => {
				const action = playerMixer.clipAction(clip);
				actions[clip.name] = action;
			});

			// --- PLAY DEFAULT RUN ANIMATION ---
			currentAction = actions["Run Forward"];
			currentAction.reset().play();

			console.log("RUN FORWARD STARTED");
		});
	}
		function playAnimation(name) {
			if (!actions || !actions[name]) return;

			// fade transition
			if (currentAction !== actions[name]) {
				if (currentAction) currentAction.fadeOut(0.15);
				currentAction = actions[name];
				currentAction.reset().fadeIn(0.15).play();
			}
		}
    // ============================================================
    // CONTROLS
    // ============================================================
    function setupControls() {

        document.addEventListener("keydown", e => {
            if (!player) return;

            if (e.key === "ArrowLeft" && lane > -1) {
				lane--;
				laneSwitching = true;
				laneSwitchStart = performance.now();
				playAnimation("Run Left");
			}

			if (e.key === "ArrowRight" && lane < 1) {
				lane++;
				laneSwitching = true;
				laneSwitchStart = performance.now();
				playAnimation("Run Right");
			}
            if (e.key === "ArrowUp" && !isJumping) jump();
        });

        // Swipe (mobile)
        let startX = 0;

        document.addEventListener("touchstart", e => {
            startX = e.touches[0].clientX;
        });

        document.addEventListener("touchend", e => {
            if (!player) return;

            let dx = e.changedTouches[0].clientX - startX;

            if (Math.abs(dx) > 40) {
                if (dx < 0 && lane > -1) lane--;
                if (dx > 0 && lane < 1) lane++;
            } else {
                if (!isJumping) jump();
            }
        });
    }

    function jump() {
        if (!player) return;

        isJumping = true;
        yVelocity = 0.20;

        sJump.currentTime = 0;
        sJump.play();
    }

    // ============================================================
    // INFINITE ROAD MOVEMENT
    // ============================================================
    function moveRoad(speed) {
		// move each road slice forward
		for (let seg of roadSegments) {
			seg.position.z += speed;

			// if a segment passes behind the player, recycle it to the front
			if (seg.position.z > 10) {

		// 🛑 DO NOT RECYCLE REMOVED HOLE SEGMENTS
		if (seg.userData.removedForHole) continue;

			seg.position.z -= ROAD_SPAN;
		}
	}

		// keep lane lines synced
		laneLines.leftLine.position.z += speed;
		laneLines.rightLine.position.z += speed;

		if (laneLines.leftLine.position.z > 50) {
			laneLines.leftLine.position.z = 0;
			laneLines.rightLine.position.z = 0;
		}
	}

		const textureLoader = new THREE.TextureLoader();
		// Neon crate texture
		const crateTexture = textureLoader.load("textures/obstacle_crate.webp");
		crateTexture.flipY = false; // required for GLTF-style textures
    // ============================================================
    function createObstacle(type) {

		let mesh;

		switch(type) {

			case "wall":
				mesh = new THREE.Mesh(
					new THREE.BoxGeometry(1.5, 3, 1),
					new THREE.MeshStandardMaterial({ color: 0x4444ff })
				);
				break;

			case "barricade":
				mesh = new THREE.Mesh(
					new THREE.BoxGeometry(2, 0.7, 1),
					new THREE.MeshStandardMaterial({ color: 0xffaa00 })
				);
				break;

			case "spike":
				mesh = new THREE.Mesh(
					new THREE.ConeGeometry(0.9, 1.2, 4),
					new THREE.MeshStandardMaterial({ color: 0xff0000 })
				);
				mesh.rotation.x = Math.PI / 2;
				break;

			case "wideBlock":
				mesh = new THREE.Mesh(
					new THREE.BoxGeometry(3, 1.0, 1.5),
					new THREE.MeshStandardMaterial({ color: 0x00ccff })
				);
				break;

			case "barrel":
				mesh = new THREE.Mesh(
					new THREE.CylinderGeometry(0.7, 0.7, 0.9, 16),
					new THREE.MeshStandardMaterial({ color: 0xaa3300 })
				);
				mesh.rotation.z = Math.PI / 2; // laying sideways
				break;

			case "tiltedCrate":
				mesh = new THREE.Mesh(
					new THREE.BoxGeometry(1.2, 0.8, 1.2),
					new THREE.MeshStandardMaterial({ map: crateTexture })
				);
				mesh.rotation.y = Math.random() * Math.PI;
				mesh.rotation.x = (Math.random() - 0.5) * 0.7;
				break;

			case "carWreck":
				mesh = new THREE.Mesh(
					new THREE.BoxGeometry(2.5, 1, 4),
					new THREE.MeshStandardMaterial({ color: 0x555555 })
				);
				mesh.rotation.y = (Math.random() - 0.5) * 0.5;
				break;

			default:
				mesh = new THREE.Mesh(
					new THREE.BoxGeometry(1.2, 0.8, 1.2),
					new THREE.MeshStandardMaterial({ color: 0xff2200 })
				);
		}

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		return mesh;
	}
	// 1️⃣ ROTATING BLADE (small)
			function createBlade() {
				// BIGGER, THICKER, MORE VISIBLE ROTATING BLADE
				const geo = new THREE.CylinderGeometry(
					1.6,   // radiusTop (was 0.7)
					1.6,   // radiusBottom
					0.25,  // thickness (was 0.05 → too flat)
					32      // segments for smoothness
				);

				const mat = new THREE.MeshStandardMaterial({
					color: 0xffffff,
					metalness: 0.9,
					roughness: 0.2,
					emissive: 0xff0000,
					emissiveIntensity: 1.8   // more glow
				});

				const blade = new THREE.Mesh(geo, mat);

				// rotate to lay flat so it spins like a saw blade
				blade.rotation.x = Math.PI / 2;

				// RAISE IT HIGHER SO PLAYER CAN SEE AND INTERACT
				blade.position.y = 0.5;   // was forced to 0.01 by spawn

				blade.userData.type = "blade";
				return blade;
			}

		// 2️⃣ LASER GATE (random height)
		function createLaserGate() {
			const heightTypes = [0.3, 1.0, 1.2];
			const chosen = heightTypes[Math.floor(Math.random() * heightTypes.length)];

			const geo = new THREE.BoxGeometry(3, 3.5, 1);  // thicker and visible
			const mat = new THREE.MeshStandardMaterial({
				emissive: 0xff0000,
				emissiveIntensity: 6
			});

			const laser = new THREE.Mesh(geo, mat);
			laser.position.y = chosen + 0.5;   // RAISED laser
			laser.userData.type = "laser";
			return laser;
		}

		// 3️⃣ SLIDING WALL (fast)
		function createSlidingWall() {
    // FIXED HEIGHT FOR REALISTIC JUMPING
			const geo = new THREE.BoxGeometry(1.5, 1.1, 1);  // was 2.5 tall → impossible to jump

			const mat = new THREE.MeshStandardMaterial({ color: 0x0099ff });
			const wall = new THREE.Mesh(geo, mat);

			wall.userData.type = "slide";
			wall.userData.t = Math.random() * 10;

			return wall;
		}

		// 4️⃣ ROAD HOLE (real gap: removes a road segment + adds trigger)
		function createRealHole(xLane, zPos) {

			const laneWidth = ROAD_WIDTH / 3;

			const laneIndex =
				xLane < 0 ? 0 :
				xLane > 0 ? 2 : 1;

			const segIndex = roadSegments.findIndex(seg =>
				seg.userData.lane === laneIndex &&
				Math.abs(seg.position.z - zPos) < SEG_LENGTH
			);

			let seg = null;

			// --- Remove road segment but keep its transform for hole image ---
			if (segIndex !== -1) {
				seg = roadSegments[segIndex];
				seg.visible = false;
				seg.userData.removedForHole = true;
			}

			// --- Invisible falling trigger ---
			const holeGeo = new THREE.PlaneGeometry(laneWidth, SEG_LENGTH * 0.5);
			const holeMat = new THREE.MeshBasicMaterial({
				opacity: 0,
				transparent: true,
				depthWrite: false
			});

			const trigger = new THREE.Mesh(holeGeo, holeMat);
			trigger.rotation.x = -Math.PI / 2;
			trigger.position.set(xLane, 0.01, zPos);
			trigger.userData.type = "hole";

			scene.add(trigger);
			obstacles.push(trigger); // TRIGGER must move

			// --- HOLE IMAGE ---
			const imgGeo = new THREE.PlaneGeometry(laneWidth * 1.45, SEG_LENGTH * 1.1);
			const imgMat = new THREE.MeshBasicMaterial({
				map: holeTexture,
				transparent: true,
				opacity: 1
			});

			const holeImg = new THREE.Mesh(imgGeo, imgMat);
			holeImg.rotation.x = -Math.PI / 2;
			holeImg.renderOrder = 9999;

			// --- CRUCIAL: parent to the removed road segment ---
			if (seg) {
				seg.add(holeImg);
				holeImg.position.set(0, 0.03, 0); // local coords
			} else {
				// fallback: absolute placement if missing
				holeImg.position.set(xLane, 0.03, zPos);
				scene.add(holeImg);
			}

			return trigger;
		}
		function addDepthFog(xLane, zPos) {
			const fogGeo = new THREE.PlaneGeometry(8, 8);
			const fogMat = new THREE.MeshBasicMaterial({
				color: 0x000000,
				opacity: 0.5,
				transparent: true
			});

			const fog = new THREE.Mesh(fogGeo, fogMat);
			fog.rotation.x = -Math.PI / 2;
			fog.position.set(xLane, -0.8, zPos);   // lower beneath road

			scene.add(fog);
			fog.userData.type = "nofog";
			obstacles.push(fog);
		}
		
		// ==========================
											

// ==========================
// BROKEN ROAD EDGES
// ==========================
		function createBrokenEdge(side = "left") {
			// Jagged uneven geometry
			edge.userData.type = "nohit";
			const geo = new THREE.BoxGeometry(
				1.2,      // width
				0.3,      // height
				5         // depth matching gap
			);

			const mat = new THREE.MeshStandardMaterial({
				color: 0x222222,
				emissive: 0x5500ff,
				emissiveIntensity: 0.15,
				roughness: 0.9,
				metalness: 0.1
			});

			const edge = new THREE.Mesh(geo, mat);
			edge.userData.type = "edge";

			// Random cracks effect
			edge.rotation.y = (Math.random() - 0.5) * 0.4;  
			edge.rotation.x = (Math.random() - 0.5) * 0.2;

			// Move to left or right
			if (side === "left") edge.position.x = -3.2;
			else edge.position.x = 3.2;

			// Slight tilt
			edge.position.y = 0.17;

			return edge;
		}	

	// ==========================
// FALLING ROAD CHUNKS (Level 4)
// ==========================
	function spawnFallingChunks(zPos) {
		const chunkCount = 5;

		for (let i = 0; i < chunkCount; i++) {

			const geo = new THREE.BoxGeometry(
				0.5 + Math.random() * 0.4,
				0.2,
				0.7 + Math.random() * 0.4
			);

			const mat = new THREE.MeshStandardMaterial({
				color: 0x222222,
				emissive: 0x220055,
				emissiveIntensity: 0.15,
				roughness: 0.9
			});

			const chunk = new THREE.Mesh(geo, mat);

			chunk.position.set(
				(Math.random() - 0.5) * 4,  // left/right
				0.3 + Math.random() * 0.4,  // height
				zPos + (Math.random() - 0.5) * 1.5
			);

			chunk.userData.type = "fallChunk";
			chunk.userData.vy = 0.04 + Math.random() * 0.04;  // UP velocity
			chunk.userData.vr = (Math.random() - 0.5) * 0.2;  // rotation speed
			chunk.userData.delay = Math.random() * 200;        // small delay

			scene.add(chunk);
			obstacles.push(chunk);
		}
	}
	
	function laneHasObstacleNear(laneX, zPos, minDist = 10) {
		return obstacles.some(o => {
			if (!o.userData?.type) return false;
			const dx = Math.abs(o.position.x - laneX);
			const dz = Math.abs(o.position.z - zPos);
			return dx < 1 && dz < minDist;
		});
	}
	function countWallsAtZ(zPos) {
		let count = 0;
		for (const obs of obstacles) {
			if (!obs.userData) continue;
			if (obs.userData.type === "wall" && Math.abs(obs.position.z - zPos) < 2)
				count++;
		}
		return count;
	}
	
	function countLaneBlockersAtZ(zPos) {
		let lanesBlocked = new Set();

		for (const obs of obstacles) {
			if (!obs.userData) continue;

			if (["block", "crate", "wideBlock", "tiltedCrate", "carWreck"]
				.includes(obs.userData.type)) {

				if (Math.abs(obs.position.z - zPos) < 2) {
					// detect lane index from X position
					if (obs.position.x < -3) lanesBlocked.add(0);
					else if (obs.position.x > 3) lanesBlocked.add(2);
					else lanesBlocked.add(1);
				}
			}
		}

		return lanesBlocked.size; // 1, 2, or 3 lanes blocked
	}
	// SPAWNING
    // ============================================================
    function spawnObstacle() {
			if (obstacles.length > 0) {
		const realObstacles = obstacles.filter(o => o.userData?.type !== "coin" && o.userData?.type !== "power");
			if (realObstacles.length > 0) {
				const lastReal = realObstacles[realObstacles.length - 1];
				if (lastReal.position.z > -15) return;
			} // last obstacle too close → skip spawn
			}
		const laneWidth = ROAD_WIDTH / 3;
		const lanePositions = [-laneWidth, 0, laneWidth];

		const lane = Math.floor(Math.random() * 3);
		const x = lanePositions[lane];
		// 🚫 Prevent spawning 3 walls at same Z (impossible to dodge)
		if (laneHasObstacleNear(x, -40, 14)) return;
		// 🔥 Random type of obstacle
		const types = ["block", "crate", "blade", "laser", "slide", "hole"];
		const type = types[Math.floor(Math.random() * types.length)];
		// Prevent impossible 3-lane blockers
		if (["block", "crate", "wideBlock", "tiltedCrate", "carWreck"]
			.includes(type)) {

			const blocked = countLaneBlockersAtZ(-40);

			// If already 2 lanes blocked, force this obstacle to NOT be a blocker
			if (blocked >= 2) {
				type = "blade"; // or "laser" or anything avoidable
			}
		}

		let obs;

		switch (type) {
			case "crate":
				const crateGeo = new THREE.BoxGeometry(1.3, 1.0, 1.3);
				const crateMat = new THREE.MeshStandardMaterial({
					map: crateTexture,
					emissive: 0x000000,
					emissiveIntensity: 0
				});
				obs = new THREE.Mesh(crateGeo, crateMat);
				break;
			
			case "blade":
				obs = createBlade();
				break;

			case "laser":
				obs = createLaserGate();
				break;

			case "slide":
				obs = createSlidingWall();
				break;

			case "hole":
				obs = createRealHole(x, -40);
				
				break;
			
			default:
				const geometry = new THREE.BoxGeometry(1.2, 0.8, 1.2);
				const material = new THREE.MeshStandardMaterial({ color: 0xff2200 });
				obs = new THREE.Mesh(geometry, material);
				obs.userData.type = "block";
		}
		// KEEP existing Y for lasers / walls / blades etc.
			if (type !== "hole") {
				// generic placement for normal ground obstacles
				if (obs.position.y === 0) obs.position.y = 0.01;  // only ground obstacles
				obs.position.z = -40;
				obs.position.x = x;
			}
				if (countLaneBlockersAtZ(-40) >= 2 && ["block","crate","wideBlock"].includes(type)) {
				return; // skip this spawn completely
			}
			// 🛑 Prevent obstacles spawning on top of holes
			if (type !== "hole" && laneHasObstacleNear(x, -40, 20)) return;

			// 🛑 Prevent hole spawning on top of obstacles
			if (type === "hole" && laneHasObstacleNear(x, -40, 20)) return;

			obs.castShadow = true;
			scene.add(obs);
			obstacles.push(obs);
	}
    function spawnPowerup() {
        const geo = new THREE.SphereGeometry(0.7, 18, 18);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00eaff, emissive: 0x00eaff });
        const orb = new THREE.Mesh(geo, mat);

        orb.userData.type = "power";
              const laneWidth = 20 / 3;
		const lanePositions = [-laneWidth, 0, laneWidth];

		orb.position.set(
			lanePositions[Math.floor(Math.random() * 3)],
			0.6,
			-30
		);

        obstacles.push(orb);
        scene.add(orb);
    }
		function restartGame() {
			cancelAnimationFrame(animID);

			// === RESET BASIC GAME STATE ===
			score = 0;
			distance = 0;
			difficulty = 1;
			coins = 0;
			document.getElementById("coins").textContent = "Coins: 0";

			lane = 0;
			targetX = 0;
			isJumping = false;
			yVelocity = 0;
			playerFalling = false;
			fallVelocity = 0;
			laneSwitching = false;
			shield = false;
			shieldTimer = 0;

			// === RESET PLAYER ===
			if (player) {
				player.position.set(0, 0.05, 0);
				player.rotation.y = Math.PI;

				if (currentAction) currentAction.stop();
				currentAction = actions["Run Forward"];
				currentAction.reset().play();
			}

			// === CLEAR ALL OBSTACLES ===
			obstacles.forEach(o => scene.remove(o));
			obstacles = [];

			// === RESET ROAD SEGMENTS (HOLES FIX!!!) ===
			for (let seg of roadSegments) {
				seg.visible = true;
				seg.userData.removedForHole = false;
			}

			// reset lane lines
			laneLines.leftLine.position.z = 0;
			laneLines.rightLine.position.z = 0;

			// Hide the Game Over screen
			hideGameOver();

			gameRunning = true;

			// === START BRAND NEW LOOP ===
			animID = requestAnimationFrame(animate);
		}
    // ============================================================
    // GAME OVER PANEL
    // ============================================================
    function showGameOver() {
		gameRunning = false;

		const screen = document.getElementById("gameOverScreen");
		document.getElementById("finalScore").textContent = "Score: " + score;
		document.getElementById("finalDistance").textContent =
			"Distance: " + Math.floor(distance) + "m";

		// make sure it is VISIBLE again
		screen.style.display = "flex";   // or "block" depending on your CSS
		screen.classList.add("show");    // animation / glow

		document.getElementById("restartBtn").onclick = () => {
			hideGameOver();
			restartGame();
		};

		document.getElementById("menuBtn").onclick = () => {
			hideGameOver();
			document.getElementById("mainMenu").style.display = "flex";
			location.reload();
		};
	}
    // ============================================================
    // UPDATE FUNCTIONS
    // ============================================================
    function updatePlayerMovement() {
        if (!player) return;

        const laneWidth = 20 / 3;
		targetX = lane * laneWidth;
        player.position.x += (targetX - player.position.x) * 0.18;
		if (!isJumping && !playerFalling) {
			player.position.y = 0.05 * Math.sin(performance.now() * 0.02);
		}
        if (isJumping) {
			yVelocity += gravity;
			player.position.y += yVelocity;

			// reached ground only when descending
			if (player.position.y <= 0.05 && yVelocity < 0) {
				player.position.y = 0.05;
				isJumping = false;
				yVelocity = 0;
			}
		}
		// --- JUMP ---
// --- ANIMATION LOGIC ---
			if (playerFalling) {
				playAnimation("Falling Idle");
				return;
			}

			if (isJumping) {
				playAnimation("Jump");
				return;
			}

			if (laneSwitching) {
				if (performance.now() - laneSwitchStart > 200) {
					laneSwitching = false;
				}
				return;
			}

			playAnimation("Run Forward");
					
    }
	
	
	function updateObstacles(speed) {

		if (!player) return;

		for (let i = obstacles.length - 1; i >= 0; i--) {
			const obs = obstacles[i];
			if (!obs) {
				obstacles.splice(i, 1);
				continue;
			}
			if (obs.userData?.type === "nohit") continue;
			if (obs.userData?.type === "nofog") continue;
			// Move obstacle toward player
			obs.position.z += speed;
			// --- BLADE ROTATION ---
			if (obs.userData?.type === "blade") {
				obs.rotation.z += 0.25; // small fast spin
			}

			// --- SLIDING WALL MOVEMENT ---
			if (obs.userData?.type === "slide") {
				obs.userData.t += 0.15;
				obs.position.x += Math.sin(obs.userData.t) * 0.12; // fast slide
				// Prevent slide wall from leaving its lane band
				obs.position.x = THREE.MathUtils.clamp(obs.position.x, -6, 6);
			}

			
			const dx = Math.abs(obs.position.x - player.position.x);
			const dz = Math.abs(obs.position.z - player.position.z);
			
			// FALLING CHUNKS
			if (obs.userData?.type === "fallChunk") {

				// Delay so chunks don't fall all at once
				obs.userData.delay -= 16;
				if (obs.userData.delay > 0) continue;

				// Move upward a bit, then fall
				obs.position.y += obs.userData.vy;
				obs.userData.vy -= 0.008; // gravity

				// Random rotation
				obs.rotation.x += obs.userData.vr;
				obs.rotation.z += obs.userData.vr * 0.5;

				// Cleanup when under road
				if (obs.position.y < -2) {
					scene.remove(obs);
					obstacles.splice(i, 1);
					continue;
				}

				continue;
			}
			// CLEANUP EDGES
			if (obs.userData?.type === "edge") {
				if (obs.position.z > player.position.z + 1.5)  {
					scene.remove(obs);
					obstacles.splice(i, 1);
				}
				continue;
			}
			// GAP (ROAD HOLE) COLLISION
			if (obs.userData?.type === "hole") {
				const dx = Math.abs(obs.position.x - player.position.x);
				const dz = Math.abs(obs.position.z - player.position.z);

				const holeWidth = 1.2;
				const holeLength = 1.2;

				const playerAboveGround = player.position.y > 0.25;

				// Only fall if OVER the hole AND NOT jumping above it
				if (!playerAboveGround && dx < holeWidth && dz < holeLength) {
					playerFalling = true;
					fallVelocity = -0.35;
				}

				continue;
			}
			// CLEANUP BEFORE COLLISION CHECK
			if (obs.position.z > player.position.z + 1.5) {
				scene.remove(obs);
				obstacles.splice(i, 1);
				continue;
			}

			// POWERUP
			if (obs.userData?.type === "power") {
				if (dx < 1 && dz < 1) {
					shield = true;
					shieldTimer = performance.now();
					sPower.currentTime = 0;
					sPower.play();
					scene.remove(obs);
					obstacles.splice(i, 1);
				}
				continue;
			}
			// COIN PICKUP
			if (obs.userData?.type === "coin") {
				if (dx < 1 && dz < 1.2) {
					coins++;
					document.getElementById("coins").textContent = "Coins: " + coins;
					scene.remove(obs);
					obstacles.splice(i, 1);
					continue;
				}
			}
			// LASER COLLISION
			if (obs.userData?.type === "laser") {
				if (dx < 1.2 && dz < 1.2) {
					if (!shield) {
						sHit.play();
						gameRunning = false;
						showGameOver();
					} else {
						shield = false;
					}
				}
				continue;
			}
			// COLLISION
			// COLLISION (fixed with per-obstacle height check)


				// tighter hitbox
				const hitX = dx < 0.8;
				const hitZ = dz < 0.4;

				// height check
				const playerAbove = player.position.y > 0.2;

				if (hitX && hitZ && !playerAbove) {
					if (shield) {
						shield = false;
						scene.remove(obs);
						obstacles.splice(i, 1);
						continue;
					}

					sHit.play();
					gameRunning = false;
					showGameOver();
					continue;
				}
		}
}
	// SIMPLE PROCEDURAL RUN ANIMATION
	// ============================================================
	function updateProceduralRun(dt) {
		if (!useProceduralRun || !player) return;

		runTime += dt;
		const speed = 4;                // how fast he pumps arms/legs
		const t = runTime * speed;

		const swingA = Math.sin(t) * 0.6;        // radians for one side
		const swingB = Math.sin(t + Math.PI) * 0.6; // opposite phase

		// arms: one forward, one backward
		animArms.forEach((arm, idx) => {
			arm.rotation.x = (idx % 2 === 0) ? swingA : swingB;
		});

		// legs: opposite to arms
		animLegs.forEach((leg, idx) => {
			leg.rotation.x = (idx % 2 === 0) ? swingB : swingA;
		});
	}
    // ============================================================
    // CAMERA — B3 AGGRESSIVE SWAY
    // ============================================================
		function updateCamera() {
			if (!player) return;

			// Smooth horizontal follow
			camera.position.x += (player.position.x - camera.position.x) * 0.12;

			// 📌 HEIGHT (perfect balance)
			camera.position.y = 6.5;

			// 📌 DISTANCE BACK (for full player body + road visibility)
			camera.position.z = 14;

			// 📌 WIDE FOV (cinematic)
			camera.fov = 60;
			camera.updateProjectionMatrix();

			// 📌 Look slightly downward & ahead
			camera.lookAt(
				player.position.x,
				player.position.y + 1.5,
				player.position.z - 8
			);
		}
		function countRealObstacles() {
			return obstacles.filter(o =>
				["crate", "blade", "laser", "slide", "block", "wall", "barricade", "spike", "wideBlock", "barrel", "tiltedCrate", "carWreck"]
				.includes(o.userData?.type)
			).length;
		}
    // ============================================================
    // MAIN LOOP
    // ============================================================
    let animID;
	function animate() {

		// --- COIN ROTATION ---
		for (let o of obstacles) {
			if (o.userData?.type === "coin") {
				o.rotation.z += coinRotationSpeed;
			}
		}

		if (Math.random() < 0.02) spawnCoin();

		if (gameRunning) {
			animID = requestAnimationFrame(animate);
		}

		const dt = clock.getDelta();
		if (playerMixer) playerMixer.update(dt);

		if (useProceduralRun) updateProceduralRun(dt);

		if (!gameRunning) {
			composer.render();
			return;
		}

		// --- PROGRESSION ---
		distance += dt * 10 * difficulty;
		score = Math.floor(distance * 2);
		difficulty = 1 + distance / 500;

		document.getElementById("score").textContent = "Score: " + score;
		document.getElementById("distance").textContent = "Distance: " + Math.floor(distance) + "m";

		// --- PLAYER FORWARD MOVEMENT (safe) ---
		const speed = 0.25 * difficulty;

		if (playerFalling) {
			player.position.y -= 0.65;
			player.position.y += fallVelocity;

			if (player.position.y < -5) {
				gameRunning = false;
				showGameOver();
			}
		}

		// --- ROAD AND OBSTACLE MOVEMENT ---
		moveRoad(speed);

		if (countRealObstacles() < 4) {
			spawnObstacle();
		}
		if (Math.random() < 0.005) spawnPowerup();
		
		// --- UPDATE MOVEMENT / COLLISIONS ---
		updatePlayerMovement();
		updateObstacles(speed);

		// --- CAMERA FOLLOWS PLAYER ---
		updateCamera();

		composer.render();
	}

    // ============================================================
    // RESIZE
    // ============================================================
    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
		renderer.setSize(window.innerWidth, window.innerHeight, false);
    }

    // ============================================================
    // START GAME
    // ============================================================
    init();
    animate();
}