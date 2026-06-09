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

document.addEventListener('DOMContentLoaded', function() {
  preloadDatasetCreationImages();
  initializeDatasetCreationPanel();
  preloadSamplingImages();
  initializeSamplingPanel();
  preloadLatentTrajectoryImages();
  initializeLatentTrajectoryPanel();
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
