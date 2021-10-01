import * as faceapi from "face-api.js";
const SSD_MOBILENETV1 = "ssd_mobilenetv1";
const TINY_FACE_DETECTOR = "tiny_face_detector";
let selectedFaceDetector = SSD_MOBILENETV1;
let minConfidence = 0.5;
const scoreThreshold = 0.5;

const faceApi = () => {
	console.log("faceApi");

	var width = 320;
	var height = 240;
	const video = document.getElementById("video");
	// const canvas = document.getElementById("canvas");
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
		var context = canvasPhoto.getContext("2d");
		context.fillStyle = "#AAA";
		context.fillRect(0, 0, canvas.width, canvas.height);

		var data = canvas.toDataURL("image/png");
		photo.setAttribute("src", data);
	}

	function takepicture() {
		var context = canvasPhoto.getContext("2d");
		console.log("start taking photo");
		console.log(width, height);
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
	function getCurrentFaceDetectionNet() {
		if (selectedFaceDetector === SSD_MOBILENETV1) {
			return faceapi.nets.ssdMobilenetv1;
		}
		if (selectedFaceDetector === TINY_FACE_DETECTOR) {
			return faceapi.nets.tinyFaceDetector;
		}
	}

	function isFaceDetectionModelLoaded() {
		return !!getCurrentFaceDetectionNet().params;
	}

	function getFaceDetectorOptions() {
		const inputSize = video.videoWidth;
		return selectedFaceDetector === SSD_MOBILENETV1
			? new faceapi.SsdMobilenetv1Options({ minConfidence })
			: new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
	}
	function getTop(l) {
		return l.map((a) => a.y).reduce((a, b) => Math.min(a, b));
	}

	function getMeanPosition(l) {
		return l
			.map((a) => [a.x, a.y])
			.reduce((a, b) => [a[0] + b[0], a[1] + b[1]])
			.map((a) => a / l.length);
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
		// canvas.width = video.videoWidth;
		// canvas.height = video.videoHeight;

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
	async function onPlay() {
		if (video.paused || video.ended || !isFaceDetectionModelLoaded()) {
			return setTimeout(() => onPlay());
		}
		const options = getFaceDetectorOptions();

		const result = await faceapi
			.detectSingleFace(video, options)
			.withFaceLandmarks()
			.then((res) => {
				if (res) {
					var eye_right = getMeanPosition(res.landmarks.getRightEye());
					var eye_left = getMeanPosition(res.landmarks.getLeftEye());
					var nose = getMeanPosition(res.landmarks.getNose());
					var mouth = getMeanPosition(res.landmarks.getMouth());
					var jaw = getTop(res.landmarks.getJawOutline());
					dataLoading.classList = "loading d-none";

					var rx = (jaw - mouth[1]) / res.detection.box.height;
					var ry =
						(eye_left[0] + (eye_right[0] - eye_left[0]) / 2 - nose[0]) /
						res.detection.box.width;
					//-ax+b = 0
					//ax+b = 100
					let yawNumber = Number(-ry.toFixed(2) * 333 + 50).toFixed(0);
					let pitchNumber = Number(-rx.toFixed(2) * 333 - 100).toFixed(0);

					yawNumber = yawNumber > 100 ? 100 : yawNumber < 0 ? 0 : yawNumber;
					pitchNumber =
						pitchNumber > 100 ? 100 : pitchNumber < 0 ? 0 : pitchNumber;

					yaw.innerHTML =
						"yaw: " +
						ry.toFixed(2) +
						"    converted: " +
						Number(-ry.toFixed(2) * 333 + 50).toFixed(0);

					pitch.innerHTML =
						"pitch: " +
						rx.toFixed(2) +
						"    converted: " +
						Number(-rx.toFixed(2) * 333 - 100).toFixed(0);

					yawPinter.style.left = yawNumber + "%";
					pitchPinter.style.top = pitchNumber + "%";

					let state = "undetected";
					if (res.detection.score > 0.3) {
						state = "front";
						if (rx > 0.2) {
							state = "top";
						} else {
							if (ry < -0.04) {
								state = "left";
							}
							if (ry > 0.04) {
								state = "right";
							}
						}
					}
					// document.querySelector(".state").textContent = state;
				} else {
					// Face was not detected
				}
			});

		if (result) {
			// const canvas = $("#overlay").get(0);
			const dims = faceapi.matchDimensions(canvas, videoEl, true);
			const resizedResult = faceapi.resizeResults(result, dims);

			if (withBoxes) {
				faceapi.draw.drawDetections(canvas, resizedResult);
			}
			faceapi.draw.drawFaceLandmarks(canvas, resizedResult);
		}
		setTimeout(() => onPlay());
	}

	async function main() {
		dataLoading.classList.remove("d-none");
		await faceapi.loadFaceLandmarkModel("./static/lib/faceApi/weights/");
		await faceapi.loadSsdMobilenetv1Model("./static/lib/faceApi/weights/");
		// await faceapi.loadTinyFaceDetectorModel("./static/lib/faceApi/weights/");

		await webCam();
		await onPlay();

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

export default faceApi;
