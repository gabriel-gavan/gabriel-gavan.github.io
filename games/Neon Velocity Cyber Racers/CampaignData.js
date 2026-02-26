import * as THREE from 'three';

export const CampaignData = {
    tracks: [
        {
            name: "Neon Circuit",
            laps: 3,
            skybox: 'assets/cyberpunk_city_skybox.webp',
            accentColor: 0x00ffff,
            roadColor: 0x111111,
            waypoints: [
                new THREE.Vector3(0, 0, 40),
                new THREE.Vector3(80, 0, 40),
                new THREE.Vector3(120, 0, 100),
                new THREE.Vector3(120, 0, 180),
                new THREE.Vector3(0, 0, 220),
                new THREE.Vector3(-120, 0, 180),
                new THREE.Vector3(-120, 0, 100),
                new THREE.Vector3(-80, 0, 40),
            ]
        },
        {
            name: "Midnight Drift",
            laps: 3,
            skybox: 'assets/skybox_midnight_city.webp',
            accentColor: 0xff00ff,
            roadColor: 0x110011,
            waypoints: [
                new THREE.Vector3(0, 0, 40),
                new THREE.Vector3(100, 0, 60),
                new THREE.Vector3(150, 0, 150),
                new THREE.Vector3(100, 0, 240),
                new THREE.Vector3(0, 0, 260),
                new THREE.Vector3(-100, 0, 240),
                new THREE.Vector3(-150, 0, 150),
                new THREE.Vector3(-100, 0, 60),
            ]
        },
        {
            name: "Desert Blitz",
            laps: 4,
            skybox: 'assets/skybox_desert_neon.webp',
            accentColor: 0xff6600,
            roadColor: 0x221100,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(100, 0, 100),
                new THREE.Vector3(200, 0, 0),
                new THREE.Vector3(300, 0, 100),
                new THREE.Vector3(200, 0, 200),
                new THREE.Vector3(100, 0, 300),
                new THREE.Vector3(0, 0, 200),
                new THREE.Vector3(-100, 0, 300),
                new THREE.Vector3(-200, 0, 200),
                new THREE.Vector3(-100, 0, 100),
            ]
        },
        {
            name: "Frozen Crystal",
            laps: 3,
            skybox: 'assets/skybox_ice_world.webp',
            accentColor: 0x00ccff,
            roadColor: 0x001122,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(150, 0, 50),
                new THREE.Vector3(250, 0, 200),
                new THREE.Vector3(150, 0, 350),
                new THREE.Vector3(0, 0, 400),
                new THREE.Vector3(-150, 0, 350),
                new THREE.Vector3(-250, 0, 200),
                new THREE.Vector3(-150, 0, 50),
            ]
        },
        {
            name: "Nebula Run",
            laps: 5,
            skybox: 'assets/skybox_outer_space_nebula.webp',
            accentColor: 0xcc00ff,
            roadColor: 0x110022,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(120, 0, 0),
                new THREE.Vector3(240, 0, 120),
                new THREE.Vector3(240, 0, 240),
                new THREE.Vector3(120, 0, 360),
                new THREE.Vector3(0, 0, 360),
                new THREE.Vector3(-120, 0, 240),
                new THREE.Vector3(-120, 0, 120),
            ]
        },
        {
            name: "Toxic Industry",
            laps: 4,
            skybox: 'assets/skybox_toxic_industrial.webp',
            accentColor: 0x33ff00,
            roadColor: 0x0a1100,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(80, 0, 80),
                new THREE.Vector3(160, 0, 0),
                new THREE.Vector3(240, 0, 80),
                new THREE.Vector3(240, 0, 160),
                new THREE.Vector3(160, 0, 240),
                new THREE.Vector3(80, 0, 160),
                new THREE.Vector3(0, 0, 240),
                new THREE.Vector3(-80, 0, 160),
                new THREE.Vector3(-80, 0, 80),
            ]
        },
        {
            name: "Chrome Ridge",
            laps: 4,
            skybox: 'assets/skybox_midnight_city.webp',
            accentColor: 0xeeeeee,
            roadColor: 0x222222,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(100, 0, 200),
                new THREE.Vector3(200, 0, 0),
                new THREE.Vector3(100, 0, -200),
                new THREE.Vector3(-100, 0, -200),
                new THREE.Vector3(-200, 0, 0),
                new THREE.Vector3(-100, 0, 200),
            ]
        },
        {
            name: "Neon Nexus",
            laps: 3,
            skybox: 'assets/cyberpunk_city_skybox.webp',
            accentColor: 0x00ffff,
            roadColor: 0x111111,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(150, 0, 50),
                new THREE.Vector3(150, 0, 150),
                new THREE.Vector3(0, 0, 200),
                new THREE.Vector3(-150, 0, 150),
                new THREE.Vector3(-150, 0, 50),
            ]
        },
        {
            name: "Final Horizon",
            laps: 5,
            skybox: 'assets/skybox_outer_space_nebula.webp',
            accentColor: 0xffff00,
            roadColor: 0x111100,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(300, 0, 0),
                new THREE.Vector3(300, 0, 300),
                new THREE.Vector3(-300, 0, 300),
                new THREE.Vector3(-300, 0, 0),
            ]
        },
        {
            name: "Infinite Grid",
            laps: 10,
            skybox: 'assets/skybox_midnight_city.webp',
            accentColor: 0x00ffaa,
            roadColor: 0x001111,
            waypoints: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(200, 0, 200),
                new THREE.Vector3(400, 0, 0),
                new THREE.Vector3(200, 0, -200),
                new THREE.Vector3(0, 0, -400),
                new THREE.Vector3(-200, 0, -200),
                new THREE.Vector3(-400, 0, 0),
                new THREE.Vector3(-200, 0, 200),
            ]
        }
    ]
};
