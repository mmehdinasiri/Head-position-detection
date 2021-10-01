import Human from "@vladmandic/human";

const human = () => {
	console.log("human");

	const config = {
		// use default values

		modelBasePath: "./static/lib/human/models",
		warmup: "face",
		debug: false,
		gesture: {
			enabled: false, // enable gesture recognition based on model results
		},
		face: {
			enabled: true, // controls if specified modul is enabled
			detector: {
				maxDetected: 1,
			},
			mesh: {
				enabled: true,
			},

			iris: {
				enabled: false,
			},

			description: {
				enabled: false,
			},

			emotion: {
				enabled: false,
			},
		},
		hand: {
			enabled: false,
		},
		filter: {
			enabled: false,
		},
		body: {
			enabled: false,
		},
		object: {
			enabled: false,
		},
		segmentation: {
			enabled: false,
		},
	};
	const human = new Human(config);

	// eslint-disable-next-line no-console
	const log = (...msg) => console.log(...msg);

	/** @type {HTMLVideoElement} */
	// @ts-ignore
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

	function calculateFaceAngle(mesh) {
		// console.log("mesh", mesh);
		if (!mesh) return {};
		const radians = (a1, a2, b1, b2) => Math.atan2(b2 - a2, b1 - a1);
		const angle = {
			// roll is face lean left/right
			// looking at x,y of outside corners of leftEye and rightEye
			roll: radians(mesh[33][0], mesh[33][1], mesh[263][0], mesh[263][1]),
			// yaw is face turn left/right
			// looking at x,z of outside corners of leftEye and rightEye
			yaw: radians(mesh[33][0], mesh[33][2], mesh[263][0], mesh[263][2]),
			// pitch is face move up/down
			// looking at y,z of top and bottom points of the face
			pitch: radians(mesh[10][1], mesh[10][2], mesh[152][1], mesh[152][2]),
		};
		let yawNumber = Number(angle.yaw.toFixed(2) * 125 + 50).toFixed(0);
		let pitchNumber = Number(angle.pitch.toFixed(2) * 125 + 50).toFixed(0);
		yawNumber = yawNumber > 100 ? 100 : yawNumber < 0 ? 0 : yawNumber;
		pitchNumber = pitchNumber > 100 ? 100 : pitchNumber < 0 ? 0 : pitchNumber;
		yaw.innerHTML =
			"yaw: " +
			angle.yaw.toFixed(2) +
			"    converted: " +
			Number(angle.yaw.toFixed(2) * 125 + 50).toFixed(0);
		pitch.innerHTML =
			"pitch: " +
			angle.pitch.toFixed(2) +
			"    converted: " +
			Number(angle.pitch.toFixed(2) * 125 + 50).toFixed(0);

		yawPinter.style.left = yawNumber + "%";
		pitchPinter.style.top = pitchNumber + "%";

		roll.innerHTML = "roll: " + angle.roll.toFixed(2);
		return angle;
	}

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

	let result;
	async function detectionLoop() {
		result = await human.detect(video); // updates result every time detection completes
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		requestAnimationFrame(detectionLoop); // run in loop
	}

	async function drawLoop() {
		dataLoading.classList = "loading d-none";
		const interpolated = await human.next(result); // interpolates results based on last known results
		await human.draw.canvas(video, canvas); // draw input video to output canvas
		if (interpolated.face[0]) {
			calculateFaceAngle(interpolated.face[0].mesh);
		}
		requestAnimationFrame(drawLoop); // run in loop
	}

	async function main() {
		dataLoading.classList.remove("d-none");
		await human.load();
		await webCam();

		await detectionLoop();
		await drawLoop();
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

export default human;
