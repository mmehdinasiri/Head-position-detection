import JEELIZFACEFILTER from "../static/lib/jeeliz/jeelizFaceFilter.module";

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
			canvasPhoto.width = width;
			canvasPhoto.height = height;
			context.drawImage(video, 0, 0, width, height);

			var data = canvasPhoto.toDataURL("image/jpeg");
			// photo.setAttribute("src", data);

			photoList.push(data);
			// console.log(photoList);
		} else {
			clearphoto();
		}
	}

	async function webCam() {
		const constraints = {
			audio: false,
			video: {
				facingMode: "user",
				resizeMode: "none",
				width: { ideal: document.body.clientWidth },
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
		console.log(video.videoWidth);
		console.log(canvas);
		canvas.width = video.videoWidth; // resize output canvas to match input
		canvas.height = video.videoHeight;
		video.addEventListener(
			"canplay",
			function (ev) {
				if (!streaming) {
					height = video.videoHeight;
					width = video.videoWidth;

					if (isNaN(height)) {
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

			let yawNumber = Number(x.toFixed(2) * 72 + 50).toFixed(0);
			let pitchNumber = Number(y.toFixed(2) * -100 + 50).toFixed(0);
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
		}
	}
	async function main(errCode, bestVideoSettings) {
		dataLoading.classList.remove("d-none");
		await webCam();
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
		startBtnTackingPhoto.addEventListener("click", () => {
			takePhotoInterval = setInterval(takepicture, 250);
		});
		stopBtnTackingPhoto.addEventListener("click", () => {
			clearInterval(takePhotoInterval);
			photoList.forEach((item) => {
				var img = document.createElement("img");
				img.classList = "photo-item";
				img.src = item;
				photoListEl.appendChild(img);
			});
		});
		stopBtn.addEventListener("click", () => {
			stopStreamedVideo(video);
		});
	}
	init();
};

export default Jeeliz;
