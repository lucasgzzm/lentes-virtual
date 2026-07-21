// Virtual Try-On Glasses v2 - 360° Real-Time Tracking
// Uses JeelizFaceFilter + JeelizCanvas2DHelper

function main() {
    var CVD = null;
    var glassesImage = new Image();
    var currentCategory = 'sol';
    var faceDetected = false;
    var lastDetectState = null;

    // Smooth interpolation state
    var smooth = {
        x: 0, y: 0, s: 1,
        rx: 0, ry: 0, rz: 0,
        initialized: false
    };
    var SMOOTH_FACTOR = 0.35;

    var els = {
        loadingOverlay: document.getElementById('loading-overlay'),
        errorOverlay: document.getElementById('error-overlay'),
        errorMessage: document.getElementById('error-message'),
        retryBtn: document.getElementById('retry-btn'),
        captureBtn: document.getElementById('capture-btn'),
        captureCanvas: document.getElementById('capture-canvas'),
        glassesOptions: document.querySelectorAll('.glasses-option'),
        categoryTabs: document.querySelectorAll('.tab'),
        cameraContainer: document.getElementById('camera-container')
    };

    els.categoryTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            switchCategory(tab.dataset.category);
        });
    });

    els.glassesOptions.forEach(function(option) {
        option.addEventListener('click', function() {
            selectGlasses(option);
        });
    });

    els.captureBtn.addEventListener('click', capturePhoto);

    els.retryBtn.addEventListener('click', function() {
        els.errorOverlay.classList.add('hidden');
        smooth.initialized = false;
        initFaceFilter();
    });

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function initFaceFilter() {
        els.loadingOverlay.classList.remove('hidden');

        JEELIZFACEFILTER.init({
            canvasId: 'jeeFaceFilterCanvas',
            NNCPath: 'https://cdn.jsdelivr.net/gh/jeeliz/jeelizFaceFilter@master/neuralNets/',
            followZRot: true,

            callbackReady: function(errCode, spec) {
                if (errCode) {
                    showError('Error al inicializar: ' + errCode);
                    return;
                }
                console.log('JeelizFaceFilter ready');
                CVD = JeelizCanvas2DHelper(spec);
                els.loadingOverlay.classList.add('hidden');
                selectGlasses(els.glassesOptions[0]);
            },

            callbackTrack: function(detectState) {
                if (!CVD) return;

                if (detectState.detected > 0.5) {
                    faceDetected = true;
                    lastDetectState = detectState;
                    els.cameraContainer.classList.add('tracking');

                    if (!smooth.initialized) {
                        smooth.x = detectState.x;
                        smooth.y = detectState.y;
                        smooth.s = detectState.s;
                        smooth.rx = detectState.rx;
                        smooth.ry = detectState.ry;
                        smooth.rz = detectState.rz;
                        smooth.initialized = true;
                    } else {
                        smooth.x = lerp(smooth.x, detectState.x, SMOOTH_FACTOR);
                        smooth.y = lerp(smooth.y, detectState.y, SMOOTH_FACTOR);
                        smooth.s = lerp(smooth.s, detectState.s, SMOOTH_FACTOR);
                        smooth.rx = lerp(smooth.rx, detectState.rx, SMOOTH_FACTOR);
                        smooth.ry = lerp(smooth.ry, detectState.ry, SMOOTH_FACTOR);
                        smooth.rz = lerp(smooth.rz, detectState.rz, SMOOTH_FACTOR);
                    }

                    drawGlasses360(smooth);
                } else {
                    faceDetected = false;
                    lastDetectState = null;
                    smooth.initialized = false;
                    els.cameraContainer.classList.remove('tracking');
                    CVD.ctx.clearRect(0, 0, CVD.canvas.width, CVD.canvas.height);
                }
                CVD.update_canvasTexture();
                CVD.draw();
            }
        });
    }

    function drawGlasses360(ds) {
        var ctx = CVD.ctx;
        var cw = CVD.canvas.width;
        var ch = CVD.canvas.height;

        ctx.clearRect(0, 0, cw, ch);

        if (!glassesImage.src || !glassesImage.complete || glassesImage.naturalWidth === 0) {
            return;
        }

        var faceCoords = CVD.getCoordinates(ds);
        var faceCenterX = faceCoords.x + faceCoords.w / 2;
        var faceCenterY = faceCoords.y + faceCoords.h * 0.38;

        // Base dimensions
        var baseW = faceCoords.w * 1.15;
        var aspectRatio = glassesImage.naturalHeight / glassesImage.naturalWidth;
        var baseH = baseW * aspectRatio;

        // 360° EFFECT: Apply perspective distortion based on head rotation
        var ry = ds.ry || 0;
        var rx = ds.rx || 0;
        var rz = ds.rz || 0;

        // Yaw (ry): horizontal rotation - squash width and shift
        var yawFactor = Math.cos(ry);
        var perspX = Math.sin(ry) * baseW * 0.12;

        // Pitch (rx): vertical tilt - squash height slightly
        var pitchFactor = Math.cos(rx * 0.5);

        // Scale based on depth (scale increases = face closer)
        var depthScale = 0.8 + ds.s * 0.5;

        var finalW = baseW * Math.abs(yawFactor) * depthScale;
        var finalH = baseH * pitchFactor * depthScale;

        // Position with perspective offset
        var glassesX = faceCenterX - finalW / 2 + perspX * depthScale;
        var glassesY = faceCenterY - finalH * 0.35;

        ctx.save();
        ctx.translate(faceCenterX, faceCenterY);

        // Roll rotation (head tilt left/right)
        ctx.rotate(rz);

        // 3D perspective transform using matrix
        // Simulate yaw by skewing the canvas
        var skewX = Math.sin(ry) * 0.15;
        var skewY = Math.sin(rx * 0.3) * 0.08;
        ctx.transform(1, skewY, skewX, 1, 0, 0);

        ctx.translate(-faceCenterX, -faceCenterY);

        // Draw with shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 8 * depthScale;
        ctx.shadowOffsetY = 3 * depthScale;

        ctx.drawImage(glassesImage, glassesX, glassesY, finalW, finalH);

        ctx.restore();
    }

    function selectGlasses(option) {
        els.glassesOptions.forEach(function(opt) {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        glassesImage.src = option.dataset.src;
    }

    function switchCategory(category) {
        currentCategory = category;
        els.categoryTabs.forEach(function(tab) {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        els.glassesOptions.forEach(function(option) {
            option.classList.toggle('hidden', option.dataset.type !== category);
        });
        var first = document.querySelector('.glasses-option[data-type="' + category + '"]:not(.hidden)');
        if (first) selectGlasses(first);
    }

    function capturePhoto() {
        var cv = els.captureCanvas;
        var ctx = cv.getContext('2d');
        var glCanvas = document.getElementById('jeeFaceFilterCanvas');

        cv.width = glCanvas.width;
        cv.height = glCanvas.height;
        ctx.drawImage(glCanvas, 0, 0);

        // Re-draw glasses at full res
        if (faceDetected && lastDetectState && CVD && glassesImage.complete && glassesImage.naturalWidth > 0) {
            var ds = smooth;
            var cw = cv.width;
            var ch = cv.height;
            var scaleRatio = cw / CVD.canvas.width;

            var faceCoords = CVD.getCoordinates(ds);
            var faceCenterX = (faceCoords.x + faceCoords.w / 2) * scaleRatio;
            var faceCenterY = (faceCoords.y + faceCoords.h * 0.38) * scaleRatio;

            var baseW = faceCoords.w * 1.15 * scaleRatio;
            var aspectRatio = glassesImage.naturalHeight / glassesImage.naturalWidth;
            var baseH = baseW * aspectRatio;

            var yawFactor = Math.cos(ds.ry);
            var perspX = Math.sin(ds.ry) * baseW * 0.12;
            var pitchFactor = Math.cos(ds.rx * 0.5);
            var depthScale = 0.8 + ds.s * 0.5;

            var finalW = baseW * Math.abs(yawFactor) * depthScale;
            var finalH = baseH * pitchFactor * depthScale;
            var glassesX = faceCenterX - finalW / 2 + perspX * depthScale;
            var glassesY = faceCenterY - finalH * 0.35;

            ctx.save();
            ctx.translate(faceCenterX, faceCenterY);
            ctx.rotate(ds.rz);
            var skewX = Math.sin(ds.ry) * 0.15;
            var skewY = Math.sin(ds.rx * 0.3) * 0.08;
            ctx.transform(1, skewY, skewX, 1, 0, 0);
            ctx.translate(-faceCenterX, -faceCenterY);
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 8 * depthScale;
            ctx.shadowOffsetY = 3 * depthScale;
            ctx.drawImage(glassesImage, glassesX, glassesY, finalW, finalH);
            ctx.restore();
        }

        var link = document.createElement('a');
        link.download = 'lentes-360-' + Date.now() + '.png';
        link.href = cv.toDataURL('image/png');
        link.click();

        els.captureBtn.style.transform = 'scale(0.95)';
        setTimeout(function() { els.captureBtn.style.transform = ''; }, 150);
    }

    function showError(msg) {
        els.loadingOverlay.classList.add('hidden');
        els.errorOverlay.classList.remove('hidden');
        els.errorMessage.textContent = msg;
    }

    initFaceFilter();
}

window.addEventListener('load', main);
