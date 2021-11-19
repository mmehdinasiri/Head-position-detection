import JEELIZFACEFILTER from "../static/lib/jeeliz/jeelizFaceFilter.module";
const fs = require("fs");
import gifshot from "gifshot";

const Jeeliz = () => {
	console.log("Jeeliz");
	const SETTINGS = {
		rotationOffsetX: 0, // negative -> look upper. in radians
		cameraFOV: 40, // in degrees, 3D camera FOV
		pivotOffsetYZ: [-0.2, -0.2], // position the rotation pivot along Y and Z axis
		detectionThreshold: 0.5, // sensibility, between 0 and 1. Less -> more sensitive
		detectionHysteresis: 0.1,
		mouthOpeningThreshold: 0.5, // sensibility of mouth opening, between 0 and 1
		mouthOpeningHysteresis: 0.05,
		scale: [1, 1], // scale of the DIV along horizontal and vertical axis
		positionOffset: [0, 0, -0.2], // set a 3D position fofset to the div
	};

	// some globalz:
	let ISDETECTED = false;
	let CAMERA = null;

	var width = 320;
	var height = 240;
	var videoWidth = 320;
	var videoHeight = 240;
	var timer;
	var maxYaw = 0;
	var minYaw = 0;
	var maxPitch = 0;
	var minPitch = 0;

	const video = document.getElementById("video");
	const canvas = document.getElementById("canvas");
	const videoContainer = document.querySelector("[data-video-container]");
	const yaw = document.querySelector("[data-yaw]");
	const roll = document.querySelector("[data-roll]");
	const pitch = document.querySelector("[data-pitch]");
	const yawPinter = document.querySelector("[data-yaw-pointer]");
	const pitchPinter = document.querySelector("[data-pitch-pointer]");
	const startBtn = document.querySelector("[data-start]");
	const stopBtn = document.querySelector("[data-stop]");
	const startBtnTackingPhoto = document.querySelector(
		"[data-start-tacking-photo]"
	);
	const stopBtnTackingPhoto = document.querySelector(
		"[data-stop-tacking-photo]"
	);
	const canvasPhoto = document.getElementById("canvas-photo");
	const photo = document.getElementById("photo");
	const photoListEl = document.querySelector("[data-photo-list]");
	const dataLoading = document.querySelector("[data-loading]");
	const dataFps = document.querySelector("[data-fps]");
	const timeElm = document.querySelector("[data-time]");
	var fps = dataFps.value;
	const yawMaxMin = document.querySelector("[yaw-max-min]");
	const pitchMaxMin = document.querySelector("[pitch-max-min]");

	const timeIntervalElm = document.querySelector("[data-time-input]");
	var timeInterval = timeIntervalElm.value;

	var photoList = [];
	var takePhotoInterval = null;
	var streaming = false;
	var streamObj = null;

	function clearphoto() {
		var context = canvas.getContext("2d");
		context.fillStyle = "#AAA";
		context.fillRect(0, 0, canvas.width, canvas.height);

		var data = canvas.toDataURL("image/png");
		photo.setAttribute("src", data);
	}

	function takepicture() {
		var context = canvasPhoto.getContext("2d");
		console.log("start taking photo");
		if (width && height) {
			canvasPhoto.width = videoWidth;
			canvasPhoto.height = videoHeight;
			context.drawImage(video, 0, 0, videoWidth, videoHeight);

			var data = canvasPhoto.toDataURL("image/jpeg");
			// photo.setAttribute("src", data);

			photoList.push(data);
			// console.log(photoList);
		} else {
			clearphoto();
		}
	}

	async function webCam() {
		// var correctHeight = window.innerHeight - 190;
		var correctHeight = screen.height - 190;
		//fix video size base on device screen size and device type
		if (screen.width <= 720) {
			videoContainer.setAttribute(
				"style",
				"height:" + correctHeight + "px !important"
			);
			videoWidth = correctHeight;
		} else {
			videoContainer.style.height = screen.height / 1.75 + "px";
			videoContainer.style.width = (screen.height / 1.75) * 0.75 + "px";
			videoWidth = (screen.height / 1.75) * 0.75;
			videoHeight = screen.height / 1.75;
		}

		const constraints = {
			audio: true,
			video: {
				width: videoWidth,
				height: videoHeight,
				facingMode: "user",
				frameRate: { max: 30 },
			},
		};
		navigator.mediaDevices
			.getUserMedia(constraints)
			.then(function (stream) {
				video.srcObject = stream;
				streamObj = stream;
				video.play();
			})
			.catch(function (err) {
				console.log("An error occurred: " + err);
			});

		const ready = new Promise((resolve) => {
			video.onloadeddata = () => resolve(true);
		});

		await ready; // wait until stream is ready
		canvas.width = videoWidth;
		canvas.height = videoHeight;
		video.addEventListener(
			"canplay",
			function (ev) {
				if (!streaming) {
					height = videoHeight;
					width = videoWidth;
					console.log(height);
					console.log(videoHeight);

					if (isNaN(height)) {
						console.log("innnnn");
						height = width / (4 / 3);
					}

					video.setAttribute("width", width);
					video.setAttribute("height", height);
					canvasPhoto.setAttribute("width", width);
					canvasPhoto.setAttribute("height", height);
					streaming = true;
				}
			},
			false
		);
	}

	// build the 3D. called once when Jeeliz Face Filter is OK:
	function init_scene(spec) {
		// init projection parameters:
		const domRect = spec.canvasElement.getBoundingClientRect();
		const width = domRect.width;
		const height = domRect.height;

		const aspectRatio = width / height;
		const w2 = width / 2,
			h2 = height / 2;
		const perspectivePx = Math.round(
			Math.pow(w2 * w2 + h2 * h2, 0.5) /
				Math.tan((SETTINGS.cameraFOV * Math.PI) / 180)
		);
		CAMERA = {
			scale: new THREE.Vector3(width, height, perspectivePx / 2.0),
			aspect: aspectRatio,
			fov: SETTINGS.cameraFOV,
		};
	} //end init_scene()

	function callbackTrack(detectState) {
		if (
			ISDETECTED &&
			detectState.detected <
				SETTINGS.detectionThreshold - SETTINGS.detectionHysteresis
		) {
			// DETECTION LOST
			ISDETECTED = false;
		} else if (
			!ISDETECTED &&
			detectState.detected >
				SETTINGS.detectionThreshold + SETTINGS.detectionHysteresis
		) {
			// FACE DETECTED
			ISDETECTED = true;
		}
		console.log("----------------------");
		if (ISDETECTED) {
			// move the cube in order to fit the head:
			const tanFOV = Math.tan((CAMERA.aspect * CAMERA.fov * Math.PI) / 360); //tan(FOV/2), in radians
			const W = detectState.s; //relative width of the detection window (1-> whole width of the detection window)
			const D = 1 / (2 * W * tanFOV); //distance between the front face of the cube and the camera

			// coords in 2D of the center of the detection window in the viewport:
			const xv = detectState.x;
			const yv = detectState.y;

			// coords in 3D of the center of the cube (in the view coordinates system):
			const z = -D - 0.5; // minus because view coordinate system Z goes backward. -0.5 because z is the coord of the center of the cube (not the front face)
			const x = xv * D * tanFOV;
			const y = (yv * D * tanFOV) / CAMERA.aspect;
			// pitch.innerHTML = x.toFixed(2);
			// roll.innerHTML = z.toFixed(2);

			let yawNumber = Number(-x.toFixed(2) * 72 + 50).toFixed(0);
			let pitchNumber = Number(y.toFixed(2) * -100 + 40).toFixed(0);
			yaw.innerHTML =
				"yaw: " +
				x.toFixed(2) +
				"    converted: " +
				Number(x.toFixed(2) * 72 + 50).toFixed(0);
			pitch.innerHTML =
				"pitch: " +
				y.toFixed(2) +
				"    converted: " +
				Number(y.toFixed(2) * -100 + 50).toFixed(0);

			yawNumber = yawNumber > 100 ? 100 : yawNumber < 0 ? 0 : yawNumber;
			pitchNumber = pitchNumber > 100 ? 100 : pitchNumber < 0 ? 0 : pitchNumber;

			yawPinter.style.left = yawNumber + "%";
			pitchPinter.style.top = pitchNumber + "%";
			if (x > 0 && x > maxYaw) {
				maxYaw = x;
			}
			if (x < 0 && x < minYaw) {
				minYaw = x;
			}

			if (y > 0 && y > maxPitch) {
				maxPitch = y;
			}
			if (y < 0 && y < minPitch) {
				minPitch = y;
			}
		}
	}
	async function main(errCode, bestVideoSettings) {
		dataLoading.classList.remove("d-none");
		await webCam(video);
		if (errCode) {
			alert(errCode);
			return;
		}
		JEELIZFACEFILTER.init({
			maxFacesDetected: 1,
			animateDelay: 1, // let small delay to avoid DOM freeze
			canvasId: "canvas",
			NNCPath: "./static/lib/jeeliz/neuralNets/",
			videoSettings: {
				videoElement: video,
				facingMode: "user",
				flipX: false,
			},
			callbackReady: function (errCode, spec) {
				console.log("callbackReady");
				dataLoading.classList = "loading d-none";
				init_scene(spec);
			},

			callbackTrack: callbackTrack,
			successCallback: function () {
				console.log("INFO in index.js: successCallback() called");
			},
			errorCallback: function (errCode) {
				console.log("ERROR in index.js: ", errCode);
			},
		});
		videoContainer.classList.remove("d-none");
		videoContainer.classList += " d-block";
	}
	async function stopStreamedVideo(videoElem) {
		await videoElem.pause();
		const stream = videoElem.srcObject;
		const tracks = stream.getTracks();

		tracks.forEach(function (track) {
			track.stop();
		});

		// videoElem.srcObject = null;
	}
	function init() {
		startBtn.addEventListener("click", () => {
			main();
		});
		dataFps.addEventListener("change", function () {
			fps = this.value;
		});
		timeIntervalElm.addEventListener("input", function () {
			timeInterval = this.value;
		});

		startBtnTackingPhoto.addEventListener("click", () => {
			var time = 0;
			timer = setInterval(function () {
				if (time == timeInterval) {
					stopRecordingFn();
					clearInterval(timer);
				}

				timeElm.innerHTML = time;
				time = time + 1;
			}, 1000);
			console.log(fps);
			takePhotoInterval = setInterval(takepicture, fps);
			maxYaw = 0;
			maxPitch = 0;
			minYaw = 0;
			minPitch = 0;
		});
		var stopRecordingFn = () => {
			dataLoading.classList.toggle("d-none");
			clearInterval(timer);
			clearInterval(takePhotoInterval);
			// gifshot.stopVideoStreaming();
			// photoList.forEach((item) => {
			// 	var img = document.createElement("img");
			// 	img.classList = "photo-item";
			// 	img.src = item;
			// 	photoListEl.appendChild(img);
			// });

			gifshot.createGIF(
				{
					images: photoList,
					gifWidth: videoWidth,
					gifHeight: videoHeight,
				},
				function (obj) {
					if (!obj.error) {
						console.log("start");
						dataLoading.classList.toggle("d-none");
						var image = obj.image,
							animatedImage = document.createElement("img");
						animatedImage.src = image;
						document.body.appendChild(animatedImage);
						photoList = [];
					}
				}
			);
			yawMaxMin.innerHTML =
				"max Yaw= " + maxYaw.toFixed(2) + " and min Yaw= " + minYaw.toFixed(2);
			pitchMaxMin.innerHTML =
				"max Pitch= " +
				maxPitch.toFixed(2) +
				" and min Pitch= " +
				minPitch.toFixed(2);
		};
		stopBtnTackingPhoto.addEventListener("click", () => {
			stopRecordingFn();
		});
		stopBtn.addEventListener("click", () => {
			stopStreamedVideo(video);
		});
	}
	init();
};

export default Jeeliz;
