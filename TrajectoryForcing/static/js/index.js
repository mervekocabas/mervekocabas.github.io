window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 240;
var DATASET_CREATION_FRAMES_1 = [
  "./static/images/dataset_creation/data_1/data_1_1.png",
  "./static/images/dataset_creation/data_1/data_1_2.png",
  "./static/images/dataset_creation/data_1/data_1_3.png",
  "./static/images/dataset_creation/data_1/data_1_4.png"
];
var DATASET_CREATION_FRAMES_2 = [
  "./static/images/dataset_creation/data_2/data_2_1.png",
  "./static/images/dataset_creation/data_2/data_2_2.png",
  "./static/images/dataset_creation/data_2/data_2_3.png",
  "./static/images/dataset_creation/data_2/data_2_4.png"
];
var DATASET_CREATION_FRAMES_3 = [
  "./static/images/dataset_creation/data_3/data_3_1.png",
  "./static/images/dataset_creation/data_3/data_3_2.png",
  "./static/images/dataset_creation/data_3/data_3_3.png",
  "./static/images/dataset_creation/data_3/data_3_4.png"
];
var DATASET_CREATION_FRAME_DURATION = 1000;

// Trajectory Forcing Sampling: 6 generated samples, each decoded at the 4
// coarse-to-fine trajectory levels (<name>_1 = coarsest .. <name>_4 = finest).
var SAMPLING_NAMES = [
  "persiancat", "lighthouse", "teddybear", "daisy", "cheeseburger", "sportscar"
];
function samplingFrames(name) {
  return [
    "./static/images/sampling/" + name + "/" + name + "_1.png",
    "./static/images/sampling/" + name + "/" + name + "_2.png",
    "./static/images/sampling/" + name + "/" + name + "_3.png",
    "./static/images/sampling/" + name + "/" + name + "_4.png"
  ];
}
var SAMPLING_FRAMES = SAMPLING_NAMES.map(samplingFrames);

// Latent generation trajectory: per sample, the PCA-colored latent levels
// (<name>_pca_1..4) shown beside the decoded levels (<name>_1..4), both swept
// in sync across the coarse-to-fine trajectory.
function samplingLatentFrames(name) {
  return [
    "./static/images/sampling/" + name + "/" + name + "_pca_1.png",
    "./static/images/sampling/" + name + "/" + name + "_pca_2.png",
    "./static/images/sampling/" + name + "/" + name + "_pca_3.png",
    "./static/images/sampling/" + name + "/" + name + "_pca_4.png"
  ];
}
var SAMPLING_LATENT_FRAMES = SAMPLING_NAMES.map(samplingLatentFrames);

var interp_images = [];
var datasetCreationImages = [];
var datasetCreationIntervalStarted = false;
var samplingImages = [];
var samplingIntervalStarted = false;
var latentTrajectoryImages = [];
var latentTrajectoryIntervalStarted = false;

function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function preloadDatasetCreationImages() {
  var allFrames = DATASET_CREATION_FRAMES_1
    .concat(DATASET_CREATION_FRAMES_2)
    .concat(DATASET_CREATION_FRAMES_3);
  for (var i = 0; i < allFrames.length; i++) {
    datasetCreationImages[i] = new Image();
    datasetCreationImages[i].src = allFrames[i];
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper').empty().append(image);
}

function startDatasetCreationLoop(imageId, frames) {
  var animationImage = document.getElementById(imageId);

  if (!animationImage) {
    return;
  }

  var frameIndex = 0;

  function showNextFrame() {
    frameIndex = (frameIndex + 1) % frames.length;
    animationImage.src = frames[frameIndex];
  }

  animationImage.src = frames[frameIndex];
  window.setInterval(showNextFrame, DATASET_CREATION_FRAME_DURATION);
}

function initializeDatasetCreationPanel() {
  if (datasetCreationIntervalStarted) {
    return;
  }

  datasetCreationIntervalStarted = true;
  startDatasetCreationLoop('dataset-creation-animation', DATASET_CREATION_FRAMES_1);
  startDatasetCreationLoop('dataset-creation-animation-2', DATASET_CREATION_FRAMES_2);
  startDatasetCreationLoop('dataset-creation-animation-3', DATASET_CREATION_FRAMES_3);
}

function preloadSamplingImages() {
  var idx = 0;
  for (var i = 0; i < SAMPLING_FRAMES.length; i++) {
    for (var j = 0; j < SAMPLING_FRAMES[i].length; j++) {
      samplingImages[idx] = new Image();
      samplingImages[idx].src = SAMPLING_FRAMES[i][j];
      idx++;
    }
  }
}

function preloadLatentTrajectoryImages() {
  var idx = 0;
  for (var i = 0; i < SAMPLING_LATENT_FRAMES.length; i++) {
    for (var j = 0; j < SAMPLING_LATENT_FRAMES[i].length; j++) {
      latentTrajectoryImages[idx] = new Image();
      latentTrajectoryImages[idx].src = SAMPLING_LATENT_FRAMES[i][j];
      idx++;
    }
  }
}

function initializeSamplingPanel() {
  if (samplingIntervalStarted) {
    return;
  }

  samplingIntervalStarted = true;
  for (var i = 0; i < SAMPLING_FRAMES.length; i++) {
    startDatasetCreationLoop('sampling-animation-' + SAMPLING_NAMES[i], SAMPLING_FRAMES[i]);
  }
}

// Advance two images (latent + decoded) through the same level index together,
// so the latent and its decoding always show the same trajectory step.
function startSyncedLevelLoop(latentId, decodedId, latentFrames, decodedFrames) {
  var latentImg = document.getElementById(latentId);
  var decodedImg = document.getElementById(decodedId);

  if (!latentImg || !decodedImg) {
    return;
  }

  var frameIndex = 0;
  var n = Math.min(latentFrames.length, decodedFrames.length);

  function showNextFrame() {
    frameIndex = (frameIndex + 1) % n;
    latentImg.src = latentFrames[frameIndex];
    decodedImg.src = decodedFrames[frameIndex];
  }

  latentImg.src = latentFrames[0];
  decodedImg.src = decodedFrames[0];
  window.setInterval(showNextFrame, DATASET_CREATION_FRAME_DURATION);
}

function initializeLatentTrajectoryPanel() {
  if (latentTrajectoryIntervalStarted) {
    return;
  }

  latentTrajectoryIntervalStarted = true;
  for (var i = 0; i < SAMPLING_NAMES.length; i++) {
    startSyncedLevelLoop(
      'sampling-latent-' + SAMPLING_NAMES[i],
      'sampling-decoded-' + SAMPLING_NAMES[i],
      SAMPLING_LATENT_FRAMES[i],
      SAMPLING_FRAMES[i]
    );
  }
}

function initializeImageLightbox() {
  var lightbox = document.getElementById('image-lightbox');
  var stage = document.getElementById('image-lightbox-stage');
  var expandedImage = document.getElementById('image-lightbox-image');
  var caption = document.getElementById('image-lightbox-caption');
  var zoomOutput = document.getElementById('image-lightbox-zoom');
  var zoomInButton = lightbox && lightbox.querySelector('[data-lightbox-action="zoom-in"]');
  var zoomOutButton = lightbox && lightbox.querySelector('[data-lightbox-action="zoom-out"]');
  var resetButton = lightbox && lightbox.querySelector('[data-lightbox-action="reset"]');
  var closeButton = lightbox && lightbox.querySelector('[data-lightbox-action="close"]');
  var zoomableImages = document.querySelectorAll('.zoomable-image');

  if (!lightbox || !stage || !expandedImage || !zoomableImages.length) {
    return;
  }

  var MIN_SCALE = 1;
  var MAX_SCALE = 6;
  var scale = MIN_SCALE;
  var panX = 0;
  var panY = 0;
  var previousFocus = null;
  var activePointers = new Map();
  var dragStart = null;
  var pinchStart = null;

  function clampPan() {
    var stageRect = stage.getBoundingClientRect();
    var maxX = Math.max(0, (expandedImage.offsetWidth * scale - stageRect.width) / 2);
    var maxY = Math.max(0, (expandedImage.offsetHeight * scale - stageRect.height) / 2);

    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function renderView() {
    clampPan();
    expandedImage.style.transform = 'translate3d(' + panX + 'px, ' + panY + 'px, 0) scale(' + scale + ')';
    zoomOutput.value = Math.round(scale * 100) + '%';
    zoomOutput.textContent = zoomOutput.value;
    zoomOutButton.disabled = scale <= MIN_SCALE;
    resetButton.disabled = scale <= MIN_SCALE && panX === 0 && panY === 0;
    stage.classList.toggle('is-zoomed', scale > MIN_SCALE);
  }

  function resetView() {
    scale = MIN_SCALE;
    panX = 0;
    panY = 0;
    renderView();
  }

  function setZoom(nextScale, clientX, clientY) {
    var oldScale = scale;
    var newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    var stageRect = stage.getBoundingClientRect();
    var anchorX = (clientX === undefined ? stageRect.left + stageRect.width / 2 : clientX) - stageRect.left - stageRect.width / 2;
    var anchorY = (clientY === undefined ? stageRect.top + stageRect.height / 2 : clientY) - stageRect.top - stageRect.height / 2;

    panX = anchorX - (anchorX - panX) * (newScale / oldScale);
    panY = anchorY - (anchorY - panY) * (newScale / oldScale);
    scale = newScale;

    if (scale === MIN_SCALE) {
      panX = 0;
      panY = 0;
    }

    renderView();
  }

  function openLightbox(sourceImage) {
    previousFocus = document.activeElement;
    expandedImage.alt = sourceImage.alt || 'Expanded figure';
    caption.textContent = sourceImage.alt || 'Expanded figure';
    expandedImage.src = sourceImage.currentSrc || sourceImage.src;
    lightbox.hidden = false;
    document.body.classList.add('image-lightbox-open');
    resetView();
    closeButton.focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) {
      return;
    }

    lightbox.hidden = true;
    document.body.classList.remove('image-lightbox-open');
    expandedImage.removeAttribute('src');
    activePointers.clear();
    dragStart = null;
    pinchStart = null;

    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  }

  zoomableImages.forEach(function(image) {
    image.setAttribute('tabindex', '0');
    image.setAttribute('role', 'button');
    image.setAttribute('aria-haspopup', 'dialog');
    image.setAttribute('aria-label', (image.alt || 'Figure') + '. Open larger image.');

    image.addEventListener('click', function() {
      openLightbox(image);
    });

    image.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(image);
      }
    });
  });

  zoomInButton.addEventListener('click', function() {
    setZoom(scale * 1.3);
  });

  zoomOutButton.addEventListener('click', function() {
    setZoom(scale / 1.3);
  });

  resetButton.addEventListener('click', resetView);
  closeButton.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', function(event) {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  stage.addEventListener('wheel', function(event) {
    event.preventDefault();
    setZoom(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
  }, { passive: false });

  stage.addEventListener('dblclick', function(event) {
    setZoom(scale > MIN_SCALE ? MIN_SCALE : 2, event.clientX, event.clientY);
  });

  stage.addEventListener('pointerdown', function(event) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);

    if (activePointers.size === 1) {
      dragStart = { x: event.clientX, y: event.clientY, panX: panX, panY: panY };
      stage.classList.add('is-dragging');
    } else if (activePointers.size === 2) {
      var points = Array.from(activePointers.values());
      var centerX = (points[0].x + points[1].x) / 2;
      var centerY = (points[0].y + points[1].y) / 2;
      var stageRect = stage.getBoundingClientRect();

      pinchStart = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        scale: scale,
        localX: (centerX - stageRect.left - stageRect.width / 2 - panX) / scale,
        localY: (centerY - stageRect.top - stageRect.height / 2 - panY) / scale
      };
    }
  });

  stage.addEventListener('pointermove', function(event) {
    if (!activePointers.has(event.pointerId)) {
      return;
    }

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 2 && pinchStart) {
      var points = Array.from(activePointers.values());
      var distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      var centerX = (points[0].x + points[1].x) / 2;
      var centerY = (points[0].y + points[1].y) / 2;
      var stageRect = stage.getBoundingClientRect();

      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStart.scale * distance / pinchStart.distance));
      panX = centerX - stageRect.left - stageRect.width / 2 - pinchStart.localX * scale;
      panY = centerY - stageRect.top - stageRect.height / 2 - pinchStart.localY * scale;
      renderView();
    } else if (activePointers.size === 1 && dragStart && scale > MIN_SCALE) {
      panX = dragStart.panX + event.clientX - dragStart.x;
      panY = dragStart.panY + event.clientY - dragStart.y;
      renderView();
    }
  });

  function endPointer(event) {
    activePointers.delete(event.pointerId);
    pinchStart = null;

    if (activePointers.size === 1) {
      var remainingPoint = Array.from(activePointers.values())[0];
      dragStart = { x: remainingPoint.x, y: remainingPoint.y, panX: panX, panY: panY };
    } else {
      dragStart = null;
      stage.classList.remove('is-dragging');
    }
  }

  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  document.addEventListener('keydown', function(event) {
    if (lightbox.hidden) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(scale * 1.3);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      setZoom(scale / 1.3);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    } else if (event.key.indexOf('Arrow') === 0 && scale > MIN_SCALE) {
      event.preventDefault();
      panX += event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
      panY += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
      renderView();
    }
  });

  expandedImage.addEventListener('load', resetView);
  window.addEventListener('resize', renderView);
}

document.addEventListener('DOMContentLoaded', function() {
  preloadDatasetCreationImages();
  initializeDatasetCreationPanel();
  preloadSamplingImages();
  initializeSamplingPanel();
  preloadLatentTrajectoryImages();
  initializeLatentTrajectoryPanel();
  initializeImageLightbox();
});


$(document).ready(function() {
    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      $(".navbar-burger").toggleClass("is-active");
      $(".navbar-menu").toggleClass("is-active");

    });

    var options = {
			slidesToScroll: 1,
			slidesToShow: 3,
			loop: true,
			infinite: true,
			autoplay: false,
			autoplaySpeed: 3000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);

    // Loop on each carousel initialized
    for(var i = 0; i < carousels.length; i++) {
    	// Add listener to  event
    	carousels[i].on('before:show', state => {
    		console.log(state);
    	});
    }

    // Access to bulmaCarousel instance of an element
    var element = document.querySelector('#my-element');
    if (element && element.bulmaCarousel) {
    	// bulmaCarousel instance is available as element.bulmaCarousel
    	element.bulmaCarousel.on('before-show', function(state) {
    		console.log(state);
    	});
    }

    /*var player = document.getElementById('interpolation-video');
    player.addEventListener('loadedmetadata', function() {
      $('#interpolation-slider').on('input', function(event) {
        console.log(this.value, player.duration);
        player.currentTime = player.duration / 100 * this.value;
      })
    }, false);*/
    preloadInterpolationImages();
    $('#interpolation-slider').on('input', function(event) {
      setInterpolationImage(this.value);
    });
    setInterpolationImage(0);
    $('#interpolation-slider').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();
    initializeDatasetCreationPanel();
    preloadSamplingImages();
    initializeSamplingPanel();
    preloadLatentTrajectoryImages();
    initializeLatentTrajectoryPanel();

})
