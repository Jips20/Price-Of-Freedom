
import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';

let isPaused = false;
window.togglePause = togglePause;

// ===== RADIO =====
let radioStations = [
    { name: "90.7 SIEG HAIL RADIO",    file: "music/90.7 SIEG HAIL RADIO.mp3" },
    { name: "91.3 HEIL HITLER RADIO",   file: "music/91.3 HAIL HITLER RADIO.mp3" },
    { name: "91.5 WILL RADIO",          file: "music/91.5 WILL RADIO.mp3" },
    { name: "95.2 O SHOPPING FM",       file: "music/95.2 O SHOPPING RADIO.mp3" },
    { name: "96.3 NEIN ROCK KM",        file: "music/96.3 NEIN ROCK RADIO.mp3" },
    { name: "97.1 BANZAIM WM",          file: "music/97.1 BANZAII RADIO.mp3" },
    { name: "97.2 PAPA RADIO",          file: "music/97.2 PAPA RADIO.mp3" }
];
let currentStationIndex = 0;
let radioAudio = null;

// ===== LEADERBOARD =====
function saveLeaderboard(sc) {
    let lb = JSON.parse(localStorage.getItem("owLeaderboard")) || [];
    lb.push(sc);
    lb = lb
        .filter(n => typeof n === 'number' && !isNaN(n))
        .sort((a, b) => b - a)
        .slice(0, 5);
    localStorage.setItem("owLeaderboard", JSON.stringify(lb));
}

function showLeaderboard() {
    const screen = document.getElementById("leaderboard-screen");
    const list   = document.getElementById("leaderboard-list");
    let lb = JSON.parse(localStorage.getItem("owLeaderboard")) || [];
    lb = lb.filter(n => typeof n === 'number' && !isNaN(n));

    list.innerHTML = "";

    if (lb.length === 0) {
        list.innerHTML = '<div class="lb-empty">NO RECORDS YET</div>';
    } else {
        const medals = ['first','second','third','',''];
        const ranks  = ['#1','#2','#3','#4','#5'];
        lb.forEach((s, i) => {
            const div = document.createElement("div");
            div.className = "lb-entry" + (medals[i] ? " " + medals[i] : "");
            div.textContent = `${ranks[i]}  ${s}`;
            list.appendChild(div);
        });
    }

    screen.style.display = "flex";
}

document.getElementById("leaderboard-button").addEventListener("click", showLeaderboard);
document.getElementById("close-leaderboard").addEventListener("click", () => {
    document.getElementById("leaderboard-screen").style.display = "none";
});

function playRadio(index) {
    const station = radioStations[index];
    if (radioAudio) { radioAudio.pause(); radioAudio = null; }
    radioAudio = new Audio(station.file);
    radioAudio.loop = true;
    radioAudio.volume = 0.75;
    radioAudio.play().catch(() => {});
    document.getElementById("radio-name").textContent = station.name;
    document.getElementById("radio-ui").style.display = "block";
}
function nextRadio() {
    if (isGameOver) return;
    currentStationIndex = (currentStationIndex + 1) % radioStations.length;
    playRadio(currentStationIndex);
}
function stopRadio() {
    if (radioAudio) { radioAudio.pause(); radioAudio = null; }
}

// ===== ENGINE AUDIO =====
let engineAudio = null;
function startEngineSound() {
    if (engineAudio) { engineAudio.pause(); engineAudio = null; }
    engineAudio = new Audio('music/PLAYER.mp3');
    engineAudio.volume = 0.8;
    engineAudio.loop = true;
    engineAudio.play().catch(() => {});
}
function stopEngineSound() {
    if (engineAudio) { engineAudio.pause(); engineAudio = null; }
}

// ===== URANIUM POWER ESCALATING SYSTEM =====
const URANIUM_BASE_COST = 5;
const URANIUM_COST_INCREMENT = 3;
const URANIUM_MAX_COST = 20;
const URANIUM_DURATION = 3.0;
const URANIUM_CD_PER_USE = 4.8;
const URANIUM_MAX_CD = 12.0;

let uraniumUseCount = 0;
let uraniumCooldown = 0;
let uraniumCooldownMax = 0;

function getUraniumCost() {
    return Math.min(URANIUM_MAX_COST, URANIUM_BASE_COST + uraniumUseCount * URANIUM_COST_INCREMENT);
}
function getUraniumCooldownForUse(useCount) {
    if (useCount === 0) return 0;
    return Math.min(URANIUM_MAX_CD, URANIUM_CD_PER_USE * useCount);
}

// ===== GAME STATE =====
let nitroAudio = null;
let bustedAudio = null;
let scene, camera, renderer;
let playerCar;
let scrollingMarkings = [];
let policeCars = [];
let coins = [];
let railings = [];
let currentBillboard = null;
let lastBillboardScore = 0;
let lastFrameTime = performance.now();
let moveLeft = false, moveRight = false, gasDown = false;
let basePlayerSpeed = 0.77;
let driveSpeed = basePlayerSpeed;
let score = 0;
let coinsCollected = 0;
let nitroAmt = 100;
let nitroActive = false;
let nitroTimer = 0;
const NITRO_DUR = 120;
const NITRO_BOOST = 0.85;

// ===== SPEED CURVE =====
function getPoliceSpeed(sc) {
    const t = Math.min(1, sc / 300);
    const eased = t * t * (3 - 2 * t);
    return 0.52 + eased * 0.28;
}
function getPlayerBaseSpeed(sc) {
    const t = Math.min(1, sc / 300);
    const eased = t * t * (3 - 2 * t);
    return 0.77 + eased * 0.22;
}
function getHeatLevel(sc) {
    if (sc >= 250) return 5;
    if (sc >= 150) return 4;
    if (sc >= 80)  return 3;
    if (sc >= 30)  return 2;
    if (sc >= 5)   return 1;
    return 0;
}
function getHeatLabel(sc) {
    if (sc >= 250) return "MAX HEAT";
    if (sc >= 150) return "FULL PURSUIT";
    if (sc >= 80)  return "HIGH ALERT";
    if (sc >= 30)  return "PURSUIT";
    if (sc >= 5)   return "WANTED";
    return "CRUISING";
}
function getMaxPolice(sc) {
    if (sc >= 150) return 2;
    if (sc >= 30)  return 2;
    if (sc >= 5)   return 1;
    return 1;
}

let isGameOver = false;
let gameStarted = false;
let gameLoopActive = false;

// ===== FIX: read owBest, not owLeaderboard =====
let bestScore = parseInt(localStorage.getItem('owBest')) || 0;

let policeLightFrame = 0;
let policeAlertTimer = 0;
let isGhostMode = false;
let ghostTimer = 0;
let enginePulse = 0;
let shieldOverlay = document.getElementById('shield-overlay');
let lastHeatLevel = -1;

const BILLBOARD_IMAGES = [
    'images/background.jpg','images/1.jpg','images/2.jpg','images/3.avif',
    'images/4.jpg','images/f87130c8-ba94-11ec-bc82-0a86e68a834f.jpeg',
    'images/NFSMW_Traffic_Taxi_F.webp','images/ww2-nazi-rally-nuremberg-Secrets-of-The-Third-Reich.webp.webp'
];
let billboardImageCycle = 0;

const $ = id => document.getElementById(id);
const loadingScreen  = $('loading-screen');
const loadBarFill    = $('load-bar-fill');
const loadProgress   = $('loading-progress');
const tutorialOverlay= $('tutorial-overlay');
const startBtn       = $('start-btn');
const scoreVal       = $('score-val');
const speedVal       = $('speed-val');
const bestValEl      = $('best-val');
const coinsVal       = $('coins-val');
const nitroBar       = $('nitro-bar');
const policeAlertEl  = $('police-alert');
const policeRadarEl  = $('police-radar');
const radarFillEl    = $('radar-fill');
const gameOverEl     = $('game-over');
const goReasonEl     = $('go-reason');
const goScoreVal     = $('go-score-val');
const restartBtn     = $('restart-button');

const uraniumChargeHud = $('uranium-charge-hud');
const uraniumCoinCount = $('uranium-coin-count');
const uraniumNeededLbl = $('uranium-needed-label');
const uraniumBarFill   = $('uranium-bar-fill');
const uraniumCdLabel   = $('uranium-cd-label');
const uraniumStatusLbl = $('uranium-status-label');

const roadWidth  = 16;
const roadLength = 600;
const LANE_LEFT   = -roadWidth / 3;
const LANE_CENTER = 0;
const LANE_RIGHT  =  roadWidth / 3;
const ALL_LANES   = [LANE_LEFT, LANE_CENTER, LANE_RIGHT];

function getBlockedLanesAhead() {
    if (!playerCar) return [];
    const DANGER_Z = 90;
    const blocked = [];
    policeCars.forEach(pc => {
        if (!pc.active) return;
        const distAhead = pc.model.position.z - playerCar.position.z;
        if (distAhead > -5 && distAhead < DANGER_Z) {
            ALL_LANES.forEach(l => {
                if (Math.abs(pc.laneX - l) < 0.7 && !blocked.includes(l)) blocked.push(l);
            });
        }
    });
    return blocked;
}
function pickSafeLaneForSpawn() {
    const blocked = getBlockedLanesAhead();
    const freeLanes = ALL_LANES.filter(l => !blocked.some(b => Math.abs(b - l) < 0.7));
    if (freeLanes.length <= 1) return null;
    const shuffled = freeLanes.slice().sort(() => Math.random() - 0.5);
    for (const candidate of shuffled) {
        const remainingFree = freeLanes.filter(l => Math.abs(l - candidate) > 0.7);
        if (remainingFree.length >= 1) return candidate;
    }
    return null;
}

// ===== URANIUM HUD =====
function updateUraniumHUD() {
    const cost = getUraniumCost();
    const coins = coinsCollected;
    uraniumCoinCount.textContent = coins;

    if (isGhostMode) {
        uraniumChargeHud.className = 'active-mode';
        uraniumBarFill.className = '';
        uraniumBarFill.style.width = '100%';
        uraniumBarFill.style.background = 'var(--uranium)';
        uraniumBarFill.style.boxShadow = '0 0 14px rgba(57,255,20,1)';
        uraniumNeededLbl.textContent = `${Math.ceil(ghostTimer)}s LEFT`;
        uraniumNeededLbl.style.color = 'var(--uranium)';
        uraniumCdLabel.style.display = 'none';
        uraniumStatusLbl.textContent = '⚡ URANIUM ACTIVE';
        uraniumStatusLbl.style.color = 'var(--uranium)';
        uraniumStatusLbl.classList.add('show');
        return;
    }

    if (uraniumCooldown > 0) {
        uraniumChargeHud.className = 'cooldown';
        const cdPct = (uraniumCooldown / uraniumCooldownMax) * 100;
        uraniumBarFill.className = 'cooldown-fill';
        uraniumBarFill.style.width = `${cdPct}%`;
        uraniumBarFill.style.background = 'rgba(57,255,20,.22)';
        uraniumBarFill.style.boxShadow = 'none';
        uraniumNeededLbl.textContent = `NEXT: ${getUraniumCost()} COINS`;
        uraniumNeededLbl.style.color = 'var(--muted)';
        uraniumCdLabel.style.display = 'block';
        uraniumCdLabel.textContent = `CD: ${uraniumCooldown.toFixed(1)}s`;
        uraniumStatusLbl.textContent = 'RECHARGING...';
        uraniumStatusLbl.style.color = '#ffaa44';
        uraniumStatusLbl.classList.add('show');
        return;
    }

    uraniumCdLabel.style.display = 'none';
    uraniumStatusLbl.classList.remove('show');

    const fillPct = Math.min(100, (coins / cost) * 100);
    uraniumBarFill.style.width = `${fillPct}%`;

    if (coins >= cost) {
        uraniumChargeHud.className = 'ready';
        uraniumBarFill.className = 'ready-glow';
        uraniumBarFill.style.background = 'var(--uranium)';
        uraniumBarFill.style.boxShadow = '';
        uraniumNeededLbl.textContent = 'PRESS S — READY!';
        uraniumNeededLbl.style.color = 'var(--uranium)';
        uraniumStatusLbl.textContent = '▶ URANIUM READY';
        uraniumStatusLbl.style.color = 'var(--uranium)';
        uraniumStatusLbl.classList.add('show');
    } else {
        uraniumChargeHud.className = '';
        uraniumBarFill.className = '';
        uraniumBarFill.style.background = 'var(--uranium)';
        uraniumBarFill.style.boxShadow = '0 0 5px rgba(57,255,20,.6)';
        uraniumNeededLbl.textContent = `NEED ${cost} COINS`;
        uraniumNeededLbl.style.color = 'var(--muted)';
        uraniumStatusLbl.classList.remove('show');
    }
}

function updateHeatUI(sc) {
    const heat = getHeatLevel(sc);
    if (heat === lastHeatLevel) return;
    lastHeatLevel = heat;
    for (let i = 1; i <= 5; i++) {
        const star = $(`star${i}`);
        if (i <= heat) star.classList.add('active');
        else star.classList.remove('active');
    }
    $('heat-speed-label').textContent = getHeatLabel(sc);
}

function updateHUD() {
    let kmh = Math.floor(75 + driveSpeed * 100 + (nitroActive ? 55 : 0) + (gasDown ? 25 : 0));
    scoreVal.textContent = Math.floor(score);
    speedVal.textContent = `${kmh} km/h`;
    speedVal.style.color = kmh > 200 ? '#ff6644' : kmh > 150 ? '#ffaa44' : '#88cc88';
    coinsVal.textContent = coinsCollected;
    nitroBar.style.width = `${Math.min(100, nitroAmt)}%`;
    bestValEl.textContent = Math.max(bestScore, Math.floor(score));
    updateUraniumHUD();
    updateHeatUI(score);
}

function showAlert(msg) {
    policeAlertEl.textContent = msg;
    policeAlertEl.classList.add('show');
    policeAlertTimer = 100;
}

// ===== NITRO =====
function activateNitro() {
    if (nitroAmt > 15 && !nitroActive && !isGameOver && gameStarted) {
        nitroActive = true;
        nitroTimer = NITRO_DUR;
        if (nitroAudio) { nitroAudio.pause(); nitroAudio = null; }
        nitroAudio = new Audio("music/NITRO.mp3");
        nitroAudio.loop = true;
        nitroAudio.volume = 0.8;
        nitroAudio.play().catch(() => {});
        showAlert('NITRO BOOST!');
    }
}

// ===== URANIUM POWER =====
function activateUraniumPower() {
    const cost = getUraniumCost();
    if (!isGhostMode && uraniumCooldown <= 0 && coinsCollected >= cost && !isGameOver && gameStarted) {
        isGhostMode = true;
        ghostTimer = URANIUM_DURATION;
        coinsCollected -= cost;
        uraniumUseCount++;
        uraniumCooldownMax = getUraniumCooldownForUse(uraniumUseCount);
        uraniumCooldown = uraniumCooldownMax;
        shieldOverlay.classList.add('active');
        if (playerCar) {
            playerCar.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = 0.35;
                    if (child.material.emissive) {
                        child.material.emissive.setHex(0x39ff14);
                        child.material.emissiveIntensity = 1.5;
                    }
                }
            });
        }
        updateHUD();
    }
}

// ===== GAME OVER =====
function triggerGameOver(reason) {
    if (isGhostMode) return;
    isGameOver = true;
    gameLoopActive = false;
    stopEngineSound();
    stopRadio();
    bustedAudio = new Audio("music/BUSTED.mp3");
    bustedAudio.volume = 1;
    bustedAudio.play().catch(() => {});
    goReasonEl.textContent = reason;
    let finalScore = Math.floor(score);

    if (finalScore > bestScore) {
        bestScore = finalScore;
        localStorage.setItem('owBest', bestScore);
    }

    // ===== FIX: save once, not twice =====
    saveLeaderboard(finalScore);

    goScoreVal.textContent = finalScore;
    $('go-best-line').textContent = `BEST: ${bestScore}`;
    gameOverEl.classList.add('show');
    document.getElementById("radio-ui").style.display = "none";
    setTimeout(() => { $('busted-stamp').classList.add('show'); }, 500);
}

// ===== RESTART =====
function restartGame() {
    isGameOver = false;
    gameLoopActive = false;
    score = 0;
    driveSpeed = basePlayerSpeed;
    nitroAmt = 100;
    nitroActive = false;
    nitroTimer = 0;
    coinsCollected = 0;
    isGhostMode = false;
    ghostTimer = 0;
    uraniumUseCount = 0;
    uraniumCooldown = 0;
    uraniumCooldownMax = 0;
    moveLeft = false;
    moveRight = false;
    gasDown = false;
    policeLightFrame = 0;
    lastHeatLevel = -1;

    gameOverEl.classList.remove('show');
    policeAlertEl.classList.remove('show');
    policeRadarEl.classList.remove('show');
    document.getElementById("radio-ui").style.display = "none";
    $('busted-stamp').classList.remove('show');
    $('busted-photo').style.display = 'none';
    $('busted-photo-placeholder').style.display = 'flex';

    if (playerCar) playerCar.position.set(0, 0.2, 0);
    camera.position.set(0, 3.8, -9);
    camera.lookAt(0, 0.6, 6);

    policeCars.forEach(pc => {
        pc.active = false;
        pc.model.visible = false;
        pc.model.position.set(pc.laneX, 0.2, 999);
        pc.spawnTimer = pc.spawnDelay;
    });
    coins.forEach(coin => resetCoin(coin));

    shieldOverlay.classList.remove('active');
    uraniumChargeHud.className = '';
    uraniumBarFill.className = '';
    uraniumStatusLbl.classList.remove('show');

    stopEngineSound();
    stopRadio();
    if (nitroAudio) { nitroAudio.pause(); nitroAudio = null; }
    if (bustedAudio) { bustedAudio.pause(); bustedAudio = null; }

    startEngineSound();
    playRadio(currentStationIndex);
    setTimeout(() => {
        gameStarted = true;
        gameLoopActive = true;
        showAlert('POLICE IS COMING!');
        animate();
    }, 400);
}

// ===== COIN =====
function createCoin(x, z) {
    const geometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 24);
    const material = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.2, emissive: 0x442200, emissiveIntensity: 0.8 });
    const coin = new THREE.Mesh(geometry, material);
    coin.position.set(x, 0.25, z);
    coin.rotation.x = Math.PI / 2;
    return coin;
}
function resetCoin(coin) {
    const lanes = [LANE_LEFT, LANE_CENTER, LANE_RIGHT];
    coin.position.set(lanes[Math.floor(Math.random() * lanes.length)], 0.25, 60 + Math.random() * 350);
    coin.visible = true;
}

// ===== BILLBOARD =====
function createBillboard(side, imageName) {
    const group = new THREE.Group();
    const xPos = side === 'left' ? -(roadWidth/2 + 5.5) : (roadWidth/2 + 5.5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 10, 7), poleMat);
    pole.position.y = 2.9; pole.rotation.x = 0.2; group.add(pole);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(imageName, () => {}, undefined, () => {});
    const billMat = new THREE.MeshStandardMaterial({ map: texture, emissive: 0x112244, emissiveIntensity: 0.7 });
    const billboard = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.3), billMat);
    billboard.position.set(0, 7.5, 0.25); group.add(billboard);
    const neonMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, emissive: 0xd4a017, emissiveIntensity: 1.0 });
    const topTube = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.2, 0.2), neonMat);
    topTube.position.set(0, 9.2, 0.3); group.add(topTube);
    group.position.set(xPos, 0, 70);
    group.rotation.y = side === 'left' ? 0.4 : -0.4;
    return group;
}
function spawnBillboard() {
    if (currentBillboard) scene.remove(currentBillboard);
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const imageName = BILLBOARD_IMAGES[billboardImageCycle % BILLBOARD_IMAGES.length];
    billboardImageCycle++;
    currentBillboard = createBillboard(side, imageName);
    currentBillboard.position.z = playerCar.position.z + 220;
    scene.add(currentBillboard);
}

// ===== RAILING =====
function createRailing(x, zStart, zEnd, side) {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.85, roughness: 0.3 });
    const poleMat  = new THREE.MeshStandardMaterial({ color: 0x667788, metalness: 0.8,  roughness: 0.4 });
    const length = Math.abs(zEnd - zStart);
    const numSegments = Math.floor(length / 4);
    for (let i = 0; i <= numSegments; i++) {
        const z = zStart + (i / numSegments) * length;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), poleMat);
        post.position.set(x, 0.4, z); group.add(post);
        if (i < numSegments) {
            const rl = length / numSegments;
            [[0.65],[0.45],[0.25]].forEach(([y]) => {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, rl), metalMat);
                rail.position.set(x, y, z + rl/2); group.add(rail);
            });
        }
    }
    const reflMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.5 });
    for (let i = 0; i <= numSegments; i++) {
        const z = zStart + (i / numSegments) * length;
        const refl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), reflMat);
        refl.position.set(x + (side === 'left' ? 0.08 : -0.08), 0.5, z); group.add(refl);
    }
    return group;
}

// ===== POLICE CAR =====
function createPoliceCar(laneX) {
    const group = new THREE.Group();
    const loader = new GLTFLoader();
    loader.load('models/PoliceCar.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.set(1.7, 1.7, 1.7);
        model.rotation.y = Math.PI;
        model.traverse(child => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        group.add(model);
        const headlightLeft  = new THREE.PointLight(0xffffff, 2.5, 15);
        headlightLeft.position.set(-0.6, 0.4, -1.8);
        const headlightRight = new THREE.PointLight(0xffffff, 2.5, 15);
        headlightRight.position.set( 0.6, 0.4, -1.8);
        group.add(headlightLeft, headlightRight);
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffff, emissiveIntensity: 2 });
        const bulbL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightMat);
        bulbL.position.copy(headlightLeft.position);
        const bulbR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightMat);
        bulbR.position.copy(headlightRight.position);
        group.add(bulbL, bulbR);
        const redLight  = new THREE.PointLight(0xff0000, 2, 8);
        redLight.position.set(-0.4, 0.9, 0);
        const blueLight = new THREE.PointLight(0x0044ff, 2, 8);
        blueLight.position.set( 0.4, 0.9, 0);
        group.add(redLight, blueLight);
        const redMat  = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 2 });
        const redBox  = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), redMat);
        redBox.position.copy(redLight.position);
        const blueBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), blueMat);
        blueBox.position.copy(blueLight.position);
        group.add(redBox, blueBox);
        group.userData = { redLight, blueLight, redBox, blueBox };
    });
    group.position.set(laneX, 0.2, 999);
    return group;
}

// ===== PLAYER CAR FALLBACK =====
function createPlayerCarFallback() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.7, roughness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 3.3), bodyMat);
    body.position.y = 0.25; group.add(body);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc8891e, metalness: 0.3 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.7), roofMat);
    cabin.position.y = 0.6; group.add(cabin);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 });
    [[-0.9,0.15,1.15],[0.9,0.15,1.15],[-0.9,0.15,-1.15],[0.9,0.15,-1.15]].forEach(([x,y,z]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.45, 16), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, y, z); group.add(wheel);
    });
    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffaa44, emissiveIntensity: 2 });
    const hlL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), hlMat);
    hlL.position.set(-0.6, 0.3, 1.7);
    const hlR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), hlMat);
    hlR.position.set( 0.6, 0.3, 1.7);
    group.add(hlL, hlR);
    group.position.set(0, 0.2, 0);
    return group;
}

// ===== CONTROLS =====
function setupControls() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); togglePause(); return; }
        if (!gameStarted || isGameOver) return;
        if (e.key === 'ArrowRight' || e.key === 'd') moveLeft = true;
        if (e.key === 'ArrowLeft'  || e.key === 'a') moveRight = true;
        if (e.key === 'ArrowUp'    || e.key === 'w') gasDown = true;
        if (e.key === ' '  || e.key === 'n') activateNitro();
        if (e.key === 's'  || e.key === 'S') activateUraniumPower();
        if (e.key === 'Enter') nextRadio();
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'd') moveLeft = false;
        if (e.key === 'ArrowLeft'  || e.key === 'a') moveRight = false;
        if (e.key === 'ArrowUp'    || e.key === 'w') gasDown = false;
    });
    const bind = (id, onDown, onUp) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!isGameOver) onDown(); el.classList.add('pressed'); });
        el.addEventListener('pointerup',   () => { onUp();  el.classList.remove('pressed'); });
        el.addEventListener('pointerleave',() => { onUp();  el.classList.remove('pressed'); });
    };
    bind('btn-left',  () => moveLeft  = true, () => moveLeft  = false);
    bind('btn-right', () => moveRight = true, () => moveRight = false);
    bind('btn-nitro', activateNitro, () => {});
}

function togglePause() {
    if (!gameStarted || isGameOver) return;
    isPaused = !isPaused;
    const pauseScreen = $('pause-screen');
    if (isPaused) {
        pauseScreen.style.display = "flex";
        if (engineAudio) engineAudio.pause();
        if (radioAudio) radioAudio.pause();
    } else {
        pauseScreen.style.display = "none";
        if (engineAudio) engineAudio.play().catch(() => {});
        if (radioAudio) radioAudio.play().catch(() => {});
    }
}

// ===== SPAWN POLICE =====
let policeSpawnCooldown = 1;
function spawnPoliceWave() {
    if (!playerCar) return;
    const maxAllowed = getMaxPolice(score);
    const activeCount = policeCars.filter(p => p.active).length;
    if (activeCount >= maxAllowed) return;
    const lane = pickSafeLaneForSpawn();
    if (lane === null) return;
    let car = policeCars.find(pc => !pc.active);
    if (!car) return;
    car.active = true;
    car.model.visible = true;
    car.laneX = lane;
    const spawnDist = 80 + Math.random() * 60;
    car.model.position.set(lane, 0.2, playerCar.position.z + spawnDist);
}

// ===== INIT =====
function init() {
    document.getElementById('radio-heat-wrapper').addEventListener('click', nextRadio);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0808);
    scene.fog = new THREE.FogExp2(0x0a0808, 0.007);
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 3.8, -9);
    camera.lookAt(0, 0.6, 6);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    $('container').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x3a2e28, 0.9));
    const dirLight = new THREE.DirectionalLight(0xfff0cc, 1.3);
    dirLight.position.set(5, 15, -10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    $('home-button').addEventListener("click", () => { window.location.href = "index.html"; });
    $('pause-home-button').addEventListener("click", () => { window.location.href = "index.html"; });

    ['left','right'].forEach(side => {
        const field = new THREE.Mesh(new THREE.PlaneGeometry(60, roadLength), new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 1.0 }));
        field.rotation.x = -Math.PI / 2;
        field.position.set(side === 'left' ? -(roadWidth/2 + 30) : roadWidth/2 + 30, -0.12, 0);
        scene.add(field);
    });
    ['left','right'].forEach(side => {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(6, roadLength), new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.95 }));
        s.rotation.x = -Math.PI / 2;
        s.position.set(side === 'left' ? -(roadWidth/2 + 3) : roadWidth/2 + 3, -0.11, 0);
        scene.add(s);
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadLength), new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 0.72 }));
    road.rotation.x = -Math.PI / 2; road.position.y = -0.05; road.receiveShadow = true;
    scene.add(road);

    const dashMat = new THREE.MeshStandardMaterial({ color: 0xd4a017 });
    for (let i = -roadLength/2; i < roadLength/2; i += 4.5) {
        [LANE_LEFT/2, LANE_RIGHT/2].forEach(x => {
            const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.5), dashMat);
            dash.rotation.x = -Math.PI / 2; dash.position.set(x, -0.02, i);
            scene.add(dash); scrollingMarkings.push(dash);
        });
    }
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8 });
    [-roadWidth/2+0.1, roadWidth/2-0.1].forEach(x => {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, roadLength), edgeMat);
        edge.rotation.x = -Math.PI / 2; edge.position.set(x, -0.01, 0); scene.add(edge);
    });

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x254010, roughness: 0.8 });
    const treeXs = [-(roadWidth/2+5), -(roadWidth/2+9), roadWidth/2+5, roadWidth/2+9];
    for (let z = -roadLength/2; z < roadLength/2; z += 14) {
        treeXs.forEach(tx => {
            if (Math.random() > 0.35) {
                const h = 2.5 + Math.random() * 2;
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 6), trunkMat);
                trunk.position.set(tx + (Math.random()-0.5)*1.5, h/2, z + (Math.random()-0.5)*5);
                scene.add(trunk);
                const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9+Math.random()*0.5, h*0.8, 7), leafMat);
                leaf.position.set(trunk.position.x, trunk.position.y+h*0.6, trunk.position.z);
                scene.add(leaf);
            }
        });
    }

    const loader = new GLTFLoader();
    loader.load('models/Taxi.glb', (gltf) => {
        if (playerCar) scene.remove(playerCar);
        playerCar = gltf.scene;
        playerCar.scale.set(1.4, 1.4, 1.4);
        playerCar.position.set(0, 0.15, 0);
        scene.add(playerCar);
    }, undefined, () => {});
    playerCar = createPlayerCarFallback();
    scene.add(playerCar);

    for (let i = 0; i < 20; i++) {
        const coin = createCoin(0, 50 + i * 30);
        scene.add(coin); coins.push(coin); resetCoin(coin);
    }

    const policeConfigs = [
        { laneX: LANE_LEFT,   spawnDelay: 60,  initZ: 70  },
        { laneX: LANE_RIGHT,  spawnDelay: 140, initZ: 110 },
        { laneX: LANE_CENTER, spawnDelay: 999, initZ: 160 },
        { laneX: LANE_LEFT,   spawnDelay: 999, initZ: 210 }
    ];
    policeConfigs.forEach(cfg => {
        const car = createPoliceCar(cfg.laneX);
        scene.add(car);
        policeCars.push({ model: car, laneX: cfg.laneX, spawnDelay: cfg.spawnDelay, spawnTimer: cfg.spawnDelay, active: false, initZ: cfg.initZ });
    });

    const lr = createRailing(-roadWidth/2 - 0.6, -roadLength/2 + 10, roadLength/2 - 10, 'left');
    const rr = createRailing( roadWidth/2 + 0.6, -roadLength/2 + 10, roadLength/2 - 10, 'right');
    scene.add(lr); scene.add(rr);
    railings.push(lr, rr);

    const starGeo = new THREE.BufferGeometry();
    const stars = [];
    for (let i = 0; i < 1500; i++) {
        stars.push((Math.random()-0.5)*600, (Math.random()-0.5)*200+20, (Math.random()-0.5)*400-150);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stars), 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff8e8, size: 0.2 })));

    restartBtn.addEventListener('click', restartGame);
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        loadBarFill.style.width = `${progress}%`;
        loadProgress.textContent = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                tutorialOverlay.classList.remove('hidden');
            }, 500);
        }
    }, 50);

    $('photo-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = $('busted-photo');
            img.src = ev.target.result;
            img.style.display = 'block';
            $('busted-photo-placeholder').style.display = 'none';
            setTimeout(() => { $('busted-stamp').classList.add('show'); }, 300);
        };
        reader.readAsDataURL(file);
    });
}

// ===== MAIN LOOP =====
function animate() {
    const now = performance.now();
    let delta = Math.min(0.033, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    requestAnimationFrame(animate);

    if (!gameStarted || isGameOver || !gameLoopActive || isPaused) {
        renderer.render(scene, camera);
        return;
    }

    score += 1 * delta;
    basePlayerSpeed = getPlayerBaseSpeed(score);

    if (Math.floor(score) % 15 === 0 && score > 1) {
        if (Math.floor(score) !== lastBillboardScore) {
            lastBillboardScore = Math.floor(score);
            spawnBillboard();
        }
    }

    if (isGhostMode) {
        ghostTimer -= delta;
        if (ghostTimer <= 0) {
            isGhostMode = false;
            shieldOverlay.classList.remove('active');
            if (playerCar) {
                playerCar.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.transparent = false;
                        child.material.opacity = 1;
                        if (child.material.emissive) {
                            child.material.emissive.setHex(0x000000);
                            child.material.emissiveIntensity = 0;
                        }
                    }
                });
            }
        } else {
            let pulse = 0.35 + Math.sin(Date.now() * 0.018) * 0.12;
            if (playerCar) {
                playerCar.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.opacity = pulse;
                        if (child.material.emissive) {
                            child.material.emissive.setHex(0x39ff14);
                            child.material.emissiveIntensity = 1.2 + Math.sin(Date.now() * 0.02) * 0.5;
                        }
                    }
                });
            }
        }
    }

    if (uraniumCooldown > 0 && !isGhostMode) {
        uraniumCooldown = Math.max(0, uraniumCooldown - delta);
    }

    if (nitroActive) {
        nitroTimer -= delta * 60;
        nitroAmt = Math.max(0, nitroAmt - 35 * delta);
        if (nitroTimer <= 0 || nitroAmt <= 0) {
            nitroActive = false;
            if (nitroAudio) { nitroAudio.pause(); nitroAudio.currentTime = 0; nitroAudio = null; }
            showAlert("Nitro Ended");
        }
    } else {
        nitroAmt = Math.min(100, nitroAmt + 12 * delta);
        if (nitroAudio) { nitroAudio.pause(); nitroAudio.currentTime = 0; nitroAudio = null; }
    }

    enginePulse += delta * 18;
    if (playerCar && gasDown && !isGhostMode) {
        const pulseI = 0.5 + Math.sin(enginePulse) * 0.35;
        playerCar.traverse(child => {
            if (child.isMesh && child.material && child.material.emissiveIntensity) {
                child.material.emissiveIntensity = (nitroActive ? 4 : 2.2) * pulseI;
            }
        });
    }

    if (currentBillboard) {
        currentBillboard.position.z -= driveSpeed * 1.2;
        if (currentBillboard.position.z < playerCar.position.z - 30) {
            scene.remove(currentBillboard); currentBillboard = null;
        }
    }

    let gasBoost = gasDown ? 0.38 : 0;
    let targetSpeed = basePlayerSpeed + gasBoost + (nitroActive ? NITRO_BOOST : 0);
    driveSpeed += (targetSpeed - driveSpeed) * 0.09;

    scrollingMarkings.forEach(obj => {
        obj.position.z -= driveSpeed;
        if (obj.position.z < -roadLength/2) obj.position.z = roadLength/2;
    });
    railings.forEach(railing => {
        railing.position.z -= driveSpeed;
        if (railing.position.z < -roadLength/2) railing.position.z = roadLength/2;
    });

    coins.forEach(coin => {
        if (!coin.visible) return;
        coin.position.z -= driveSpeed;
        coin.rotation.y += 0.1;
        coin.rotation.x += 0.05;
        if (coin.position.z < -roadLength/2) resetCoin(coin);
        if (playerCar && !isGameOver) {
            const dist  = Math.abs(coin.position.x - playerCar.position.x);
            const zDist = Math.abs(coin.position.z - playerCar.position.z);
            if (dist < 1.2 && zDist < 1.5 && coin.visible) {
                coin.visible = false;
                coinsCollected++;
                setTimeout(() => resetCoin(coin), 4000);
            }
        }
    });

    let policeCurrentSpeed = getPoliceSpeed(score);
    let anyPoliceNear = false;

    policeSpawnCooldown -= delta;
    if (policeSpawnCooldown <= 0) {
        spawnPoliceWave();
        const heat = getHeatLevel(score);
        policeSpawnCooldown = Math.max(0.8, 4.0 - heat * 0.5);
    }

    policeCars.forEach(pc => {
        if (!pc.active) {
            pc.spawnTimer -= delta * 20;
            if (pc.spawnTimer <= 0 && playerCar) {
                const lane = pickSafeLaneForSpawn();
                if (lane !== null) {
                    const maxAllowed = getMaxPolice(score);
                    const activeCount = policeCars.filter(p => p.active).length;
                    if (activeCount < maxAllowed) {
                        pc.active = true;
                        pc.model.visible = true;
                        pc.laneX = lane;
                        pc.model.position.set(lane, 0.2, playerCar.position.z + pc.initZ);
                    }
                }
            }
            return;
        }

        let movement = policeCurrentSpeed * (delta * 120);
        pc.model.position.z -= movement;

        if (pc.model.userData.redLight && pc.model.userData.blueLight) {
            const flash = Math.floor(performance.now() * 0.01) % 2 === 0;
            pc.model.userData.redLight.intensity  = flash ? 3 : 0.2;
            pc.model.userData.blueLight.intensity = flash ? 0.2 : 3;
            pc.model.userData.redBox.material.emissiveIntensity  = flash ? 3 : 0.5;
            pc.model.userData.blueBox.material.emissiveIntensity = flash ? 0.5 : 3;
        }

        if (playerCar && pc.model.position.z < playerCar.position.z - 40) {
            pc.active = false;
            pc.model.visible = false;
            const newLane = pickSafeLaneForSpawn();
            if (newLane !== null) {
                pc.laneX = newLane;
                pc.model.position.set(newLane, 0.2, playerCar.position.z + 80 + Math.random() * 60);
                pc.active = true;
                pc.model.visible = true;
            } else {
                pc.spawnTimer = 60;
            }
        }

        if (playerCar) {
            let dist = pc.model.position.z - playerCar.position.z;
            if (dist > 0 && dist < 75) {
                radarFillEl.style.width = `${Math.round((1 - dist / 75) * 100)}%`;
                policeRadarEl.classList.add('show');
                anyPoliceNear = true;
            }
        }
    });

    if (!anyPoliceNear) policeRadarEl.classList.remove('show');

    if (playerCar) {
        const maxX = roadWidth / 2 - 1.1;
        const moveSpeed = 0.24;
        if (moveLeft  && playerCar.position.x > -maxX) playerCar.position.x -= moveSpeed;
        if (moveRight && playerCar.position.x <  maxX) playerCar.position.x += moveSpeed;
        playerCar.rotation.z = moveLeft ? 0.12 : moveRight ? -0.12 : 0;
        playerCar.rotation.z *= 0.85;
    }

    if (playerCar) {
        camera.position.x += (playerCar.position.x * 0.45 - camera.position.x) * 0.12;
        camera.position.y += ((3.9 + (nitroActive ? 0.4 : 0)) - camera.position.y) * 0.1;
        camera.lookAt(playerCar.position.x * 0.5, 1.0, playerCar.position.z + 8);
    }

    if (playerCar && !isGhostMode) {
        const playerBox = new THREE.Box3().setFromObject(playerCar);
        for (let pc of policeCars) {
            if (!pc.active) continue;
            const policeBox = new THREE.Box3().setFromObject(pc.model);
            if (playerBox.intersectsBox(policeBox)) {
                const cost = getUraniumCost();
                if (uraniumCooldown <= 0 && coinsCollected >= cost) {
                    activateUraniumPower();
                    break;
                }
                triggerGameOver('BUSTED BY POLICE!');
                break;
            }
        }
    }

    if (policeAlertTimer > 0) {
        policeAlertTimer -= delta * 60;
        if (policeAlertTimer <= 0) policeAlertEl.classList.remove('show');
    }

    updateHUD();
    renderer.render(scene, camera);
}

// ===== START =====
startBtn.addEventListener('click', () => {
    tutorialOverlay.classList.add('hidden');
    document.getElementById('radio-heat-wrapper').style.display = 'flex';
    gameStarted = true;
    gameLoopActive = true;
    startEngineSound();
    playRadio(currentStationIndex);
    showAlert('AXIS WORLD — SURVIVE AS LONG AS YOU CAN!');
    lastFrameTime = performance.now();
    animate();
});

bestValEl.textContent = bestScore;

init();
setupControls();
