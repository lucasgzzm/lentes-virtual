// Virtual Try-On Glasses - Main Application
// Uses JeelizFaceFilter + JeelizCanvas2DHelper

function main() {
    var CVD = null;
    var glassesImage = new Image();
    var currentCategory = 'sol';
    var faceDetected = false;
    var lastDetectState = null;

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

    // Setup event listeners
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
        initFaceFilter();
    });

    function initFaceFilter() {
        els.loadingOverlay.classList.remove('hidden');

        JEELIZFACEFILTER.init({
            canvasId: 'jeeFaceFilterCanvas',
            NNCPath: 'https://cdn.jsdelivr.net/gh/jeeliz/jeelizFaceFilter@master/neuralNets/',
            
            callbackReady: function(errCode, spec) {
                if (errCode) {
                    showError('Error al inicializar: ' + errCode);
                    return;
                }
                console.log('JeelizFaceFilter ready');
                CVD = JeelizCanvas2DHelper(spec);
                els.loadingOverlay.classList.add('hidden');
                
                // Select default glasses
                selectGlasses(els.glassesOptions[0]);
            },

            callbackTrack: function(detectState) {
                if (!CVD) return;

                if (detectState.detected > 0.6) {
                    faceDetected = true;
                    lastDetectState = detectState;
                    drawGlasses(detectState);
                } else {
                    faceDetected = false;
                    lastDetectState = null;
                    CVD.ctx.clearRect(0, 0, CVD.canvas.width, CVD.canvas.height);
                }
                CVD.update_canvasTexture();
                CVD.draw();
            }
        });
    }

    function drawGlasses(ds) {
        var ctx = CVD.ctx;
        var cw = CVD.canvas.width;
        var ch = CVD.canvas.height;
        
        ctx.clearRect(0, 0, cw, ch);

        if (!glassesImage.src || !glassesImage.complete || glassesImage.naturalWidth === 0) {
            return;
        }

        // Get face coordinates using the helper
        var faceCoords = CVD.getCoordinates(ds);

        // Calculate glasses dimensions based on face width
        var glassesW = faceCoords.w * 1.1;
        var glassesH = glassesW * (glassesImage.naturalHeight / glassesImage.naturalWidth);

        // Position glasses centered on face, slightly above center (eye level)
        var glassesX = faceCoords.x + (faceCoords.w - glassesW) / 2;
        var glassesY = faceCoords.y + (faceCoords.h * 0.15) - (glassesH * 0.3);

        // Apply rotation based on head yaw (ry)
        var ry = ds.ry || 0;
        var centerX = faceCoords.x + faceCoords.w / 2;
        var centerY = faceCoords.y + faceCoords.h * 0.35;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ry * 0.4);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(glassesImage, glassesX, glassesY, glassesW, glassesH);
        ctx.restore();
    }

    function selectGlasses(option) {
        els.glassesOptions.forEach(function(opt) {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');

        var src = option.dataset.src;
        glassesImage.src = src;
    }

    function switchCategory(category) {
        currentCategory = category;

        els.categoryTabs.forEach(function(tab) {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        els.glassesOptions.forEach(function(option) {
            if (option.dataset.type === category) {
                option.classList.remove('hidden');
            } else {
                option.classList.add('hidden');
            }
        });

        var firstVisible = document.querySelector('.glasses-option[data-type="' + category + '"]:not(.hidden)');
        if (firstVisible) {
            selectGlasses(firstVisible);
        }
    }

    function capturePhoto() {
        var cv = els.captureCanvas;
        var ctx = cv.getContext('2d');
        var video = document.querySelector('#jeeFaceFilterCanvas').previousElementSibling;
        
        if (!video || !video.videoWidth) {
            // Fallback: try to capture from the WebGL canvas
            var glCanvas = document.getElementById('jeeFaceFilterCanvas');
            cv.width = glCanvas.width;
            cv.height = glCanvas.height;
            ctx.drawImage(glCanvas, 0, 0);
        } else {
            cv.width = video.videoWidth;
            cv.height = video.videoHeight;
            
            // Draw mirrored video
            ctx.translate(cv.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, cv.width, cv.height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Draw glasses overlay
            if (faceDetected && lastDetectState && CVD) {
                var ds = lastDetectState;
                var scaleX = cv.width / CVD.canvas.width;
                var scaleY = cv.height / CVD.canvas.height;

                var faceCoords = CVD.getCoordinates(ds);
                var glassesW = faceCoords.w * 1.1 * scaleX;
                var glassesH = glassesW * (glassesImage.naturalHeight / glassesImage.naturalWidth);
                var glassesX = (faceCoords.x + (faceCoords.w - faceCoords.w * 1.1) / 2) * scaleX;
                var glassesY = (faceCoords.y + (faceCoords.h * 0.15) - (glassesH / scaleY * 0.3)) * scaleY;

                var ry = ds.ry || 0;
                var centerX = (faceCoords.x + faceCoords.w / 2) * scaleX;
                var centerY = (faceCoords.y + faceCoords.h * 0.35) * scaleY;

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(ry * 0.4);
                ctx.translate(-centerX, -centerY);
                ctx.drawImage(glassesImage, glassesX, glassesY, glassesW, glassesH);
                ctx.restore();
            }
        }

        // Download
        var link = document.createElement('a');
        link.download = 'lentes-virtual-' + Date.now() + '.png';
        link.href = cv.toDataURL('image/png');
        link.click();

        // Flash effect
        els.captureBtn.style.transform = 'scale(0.95)';
        setTimeout(function() { els.captureBtn.style.transform = ''; }, 150);
    }

    function showError(msg) {
        els.loadingOverlay.classList.add('hidden');
        els.errorOverlay.classList.remove('hidden');
        els.errorMessage.textContent = msg;
    }

    // Start
    initFaceFilter();
}

window.addEventListener('load', main);
