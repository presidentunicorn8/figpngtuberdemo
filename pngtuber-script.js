document.addEventListener('DOMContentLoaded', () => {
const leftIris = document.getElementById('iris-left');
const rightIris = document.getElementById('iris-right');
const pngtuberStack = document.getElementById('pngtuber-stack');
const layers = Array.from(document.querySelectorAll('.pngtuber-layer'));

// Offscreen canvas for hit testing
const hitCanvas = document.createElement('canvas');
const hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });
let isCanvasReady = false;

// build hitmap to pose 
function buildHitMap() {
    const sampleLayer = layers[0];
    if (!sampleLayer || !sampleLayer.naturalWidth) return;

    hitCanvas.width = sampleLayer.naturalWidth;
    hitCanvas.height = sampleLayer.naturalHeight;

    hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
    layers.forEach(layer => {
    if (layer.complete && layer.naturalWidth > 0) {
        hitCtx.drawImage(layer, 0, 0);
    }
    });
    isCanvasReady = true;
}

// Build the hit map as soon as images finish loading
if (layers.every(img => img.complete)) {
    buildHitMap();
} else {
    window.addEventListener('load', buildHitMap);
}


const maxMove = 8;
const outerBoost = 1.4;
/* eye tracking */
window.addEventListener('mousemove', (event) => {
    if (!leftIris || !rightIris) return;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const percentX = (event.clientX - centerX) / centerX;
    const percentY = (event.clientY - centerY) / centerY;

    let leftMoveX = percentX * maxMove;
    let rightMoveX = percentX * maxMove;
    const moveY = percentY * maxMove;

    if (percentX > 0) {
      rightMoveX *= outerBoost;
    } else if (percentX < 0) {
      leftMoveX *= outerBoost;
    }

    leftIris.style.transform = `translate(${leftMoveX}px, ${moveY+3}px)`;
    rightIris.style.transform = `translate(${rightMoveX}px, ${moveY}px)`;
    });


    function isPixelOpaque(event) {
    if (!isCanvasReady) buildHitMap();
    
    const sampleLayer = layers[0];
    if (!sampleLayer || !sampleLayer.naturalWidth) return false;

    const rect = sampleLayer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return false;

    const scaleX = sampleLayer.naturalWidth / rect.width;
    const scaleY = sampleLayer.naturalHeight / rect.height;
    const naturalX = Math.floor(x * scaleX);
    const naturalY = Math.floor(y * scaleY);

    try {
      // Direct pixel check from pre-baked canvas memory
        const alpha = hitCtx.getImageData(naturalX, naturalY, 1, 1).data[3];
        return alpha > 20;
    } catch (e) {
        return false;
    }
}

    if (pngtuberStack) {
    pngtuberStack.addEventListener('mousemove', (event) => {
    pngtuberStack.style.cursor = isPixelOpaque(event) ? 'pointer' : 'default';
    });

    pngtuberStack.addEventListener('click', (event) => {
    if (pngtuberStack.classList.contains('poked')) return;

    if (isPixelOpaque(event)) {
        pngtuberStack.classList.add('poked');

        recordPoke(); // record in supabase 

        pngtuberStack.addEventListener('animationend', () => {
        pngtuberStack.classList.remove('poked');
        }, { once: true });
    }
    });
}
});

// Global pose state
let isWaving = false;

function setPose(poseName) {
    const pngtuberStack = document.getElementById('pngtuber-stack');
    if (!pngtuberStack) return;
    pngtuberStack.dataset.pose = poseName;
    const layers = document.querySelectorAll('.pngtuber-layer');
    let loadedCount = 0;

    layers.forEach(img => {
    // wave layer toggles visibility, not file name!
    if (img.id === 'wave-hand') {
        loadedCount++;
        return;
    }

    const currentSrc = img.src;
    let newSrc = currentSrc;

    if (poseName === 'wave') {
        newSrc = currentSrc.replace('/neutral/', '/wave/').replace('neutral_', 'wave_');
    } else {
        newSrc = currentSrc.replace('/wave/', '/neutral/').replace('wave_', 'neutral_');
    }

    img.src = newSrc;

    img.onload = () => {
        loadedCount++;
        if (loadedCount === layers.length) {
        // redo the hitmap
        if (typeof buildHitMap === 'function') buildHitMap();
        }
    };
    });

    // Re-bake hit map after pose change settles
    setTimeout(() => {
    if (typeof buildHitMap === 'function') buildHitMap();
    }, 50);
    }

// Toggle helper for boolean control
function setWaving(wavingBool) {
    isWaving = wavingBool;
    setPose(isWaving ? 'wave' : 'neutral');
}

let mouthInterval = null;
let isMouthOpen = false;

function setTalking(shouldTalk) {
    const mouth = document.querySelector('.pngtuber-layer[src*="mouth"]');
    if (!mouth) return;

    // Always clear any existing talking loop first
    clearInterval(mouthInterval);
    mouthInterval = null;

    const currentPose = document.getElementById('pngtuber-stack').dataset.pose || 'neutral';

    if (shouldTalk) {
    // Start flapping: toggles mouth open/closed every 120ms
    mouthInterval = setInterval(() => {
        isMouthOpen = !isMouthOpen;
        const mouthType = isMouthOpen ? 'mouth' : 'mouthclosed';
        mouth.src = `static/pngtuber/${currentPose}/${currentPose}_${mouthType}.png`;
    }, 120); // Adjust ms speed to make flapping faster/slower!
    } else {
    // Stop talking: reset flag and lock mouth shut
    isMouthOpen = false;
    mouth.src = `static/pngtuber/${currentPose}/${currentPose}_mouthclosed.png`;
    }
}