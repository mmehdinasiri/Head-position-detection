import JEELIZFACEFILTER from "../static/lib/jeeliz/jeelizFaceFilter.module";

const Jeeliz = () => {
	var streaming = false;
	var ISDETECTED = false;
	var actionDic = {
		0: "UP",
		1: "DOWN",
		2: "RIGHT",
		3: "LEFT",
	};
	var randomNumberList = [];
	var randomAction = "";
	var stateType = {
		INIT: "init",
		BALANCE: "balance",
		DO_BALANCE: "doBalance",
		BALANCED: "balanced",
		START_ACTIONS: "startActions",
		UP: "up",
		DOWN: "down",
		LEFT: "left",
		RIGHT: "right",
		FINISHED: "finished",
		EMPTY: "empty",
		SENDING: "sending",
		FAILED: "failed",
	};
	var photoList = [];
	var takePhotoInterval = null;
	var isStart = false;
	var isSending = false;
	var checkBalanceTimer = null;
	var state = stateType.INIT;
	var CAMERA = null;
	var step = 0;
	var maxYaw = 0;
	var minYaw = 0;
	var maxPitch = 0;
	var minPitch = 0;
	var width = 320;
	var height = 240;
	var videoWidth = 320;
	var videoHeight = 240;
	var result = null;
	var isStarted = false;
	var doBalancingInterval = null;
	var doBalancingTimer = 0;
	var doActionInterval = null;
	var doActionTimer = 0;
	var SETTINGS = {
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
	var currentValues = {
		yaw: 0,
		pitch: 0,
	};
	var valueTable = "";
	var valueTableData = [];

	var videoEl = document.querySelector("[data-video]");
	var videoWrapperEl = document.querySelector("[data-video-actions]");
	var videoContainerEl = document.querySelector("[data-video-container]");
	var canvasEl = document.querySelector("[data-canvas]");
	var yawPointerEl = document.querySelector("[data-yaw-pointer]");
	var pitchPointerEl = document.querySelector("[data-pitch-pointer]");
	var pitchGaugeEl = document.querySelector("[data-pitch-gauge]");
	var yawGaugeEl = document.querySelector("[data-yaw-gauge]");
	var startActionsTimerEl = document.querySelector(
		"[data-start-actions-timer]"
	);
	var canvasPhotoEl = document.querySelector("[data-canvas-photo]");
	var actionTextEl = document.querySelector("[data-action-text]");
	var arrowUp = document.querySelector("[data-arrow-up]");
	var arrowDown = document.querySelector("[data-arrow-down]");
	var arrowLeft = document.querySelector("[data-arrow-left]");
	var arrowRight = document.querySelector("[data-arrow-right]");
	var timerEl = document.querySelector("[data-timer]");
	var webCam = function () {
		if (screen.width <= 720) {
			videoContainerEl.style.height = screen.width / 1.25 + "px";
			videoContainerEl.style.width = screen.width / 1.25 + "px";

			videoWidth = (screen.height / 1.75) * 0.75;
			videoHeight = screen.height / 1.75;
		} else {
			videoWidth = (screen.height / 1.75) * 0.75;
			videoHeight = screen.height / 1.75;

			videoContainerEl.style.height = screen.height / 2 + "px";
			videoContainerEl.style.width = screen.height / 2 + "px";
		}

		const constraints = {
			audio: true,
			video: {
				facingMode: "user",
				frameRate: { max: 30 },
			},
		};
		navigator.mediaDevices
			.getUserMedia(constraints)
			.then(function (stream) {
				videoEl.srcObject = stream;
				streamObj = stream;
				videoEl.play();
			})
			.catch(function (err) {
				console.log("An error occurred: " + err);
			});

		const ready = new Promise((resolve) => {
			videoEl.onloadeddata = () => resolve(true);
		}).then(function () {
			canvas.width = videoWidth;
			canvas.height = videoHeight;
			videoEl.addEventListener(
				"canplay",
				function (ev) {
					if (!streaming) {
						height = videoHeight;
						width = videoWidth;

						if (isNaN(height)) {
							height = width / (4 / 3);
						}

						videoEl.setAttribute("width", width);
						videoEl.setAttribute("height", height);
						canvasPhotoEl.setAttribute("width", width);
						canvasPhotoEl.setAttribute("height", height);
						streaming = true;
						runDetector();
					}
				},
				false
			);
		});
	};
	var runDetector = function () {
		JEELIZFACEFILTER.init({
			maxFacesDetected: 1,
			animateDelay: 1, // let small delay to avoid DOM freeze
			canvasId: "canvas",
			NNCPath: "./static/lib/jeeliz/neuralNets/",
			videoSettings: {
				videoElement: videoEl,
				facingMode: "user",
				flipX: false,
			},
			callbackReady: function (errCode, spec) {
				console.log("callbackReady");
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
	};
	var init_scene = function (spec) {
		// init projection parameters:
		var domRect = spec.canvasElement.getBoundingClientRect();
		var width = domRect.width;
		var height = domRect.height;

		var aspectRatio = width / height;
		var w2 = width / 2,
			h2 = height / 2;
		var perspectivePx = Math.round(
			Math.pow(w2 * w2 + h2 * h2, 0.5) /
				Math.tan((SETTINGS.cameraFOV * Math.PI) / 180)
		);
		CAMERA = {
			scale: new THREE.Vector3(width, height, perspectivePx / 2.0),
			aspect: aspectRatio,
			fov: SETTINGS.cameraFOV,
		};
	};
	var callbackTrack = function (detectState) {
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
			var tanFOV = Math.tan((CAMERA.aspect * CAMERA.fov * Math.PI) / 360); //tan(FOV/2), in radians
			var W = detectState.s; //relative width of the detection window (1-> whole width of the detection window)
			var D = 1 / (2 * W * tanFOV); //distance between the front face of the cube and the camera

			// coords in 2D of the center of the detection window in the viewport:
			var xv = detectState.x;
			var yv = detectState.y;

			// coords in 3D of the center of the cube (in the view coordinates system):
			var z = -D - 0.5; // minus because view coordinate system Z goes backward. -0.5 because z is the coord of the center of the cube (not the front face)
			var x = xv * D * tanFOV;
			var y = (yv * D * tanFOV) / CAMERA.aspect;
			var yawNumber = Number(-x.toFixed(2) * 72 + 50).toFixed(0);
			var pitchNumber = Number(y.toFixed(2) * -100 + 20).toFixed(0);
			currentValues = {
				yaw: x.toFixed(2),
				pitch: y.toFixed(2),
			};
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
			if (state === stateType.FAILED) {
				selectHint();
				return false;
			}
			if (state === stateType.INIT) {
				isBalance(yawNumber, pitchNumber);
				videoContainerEl.classList.remove("isLoading");
			}
			if (state === stateType.BALANCE) {
				showIndicator();
				selectHint();
			}
			if (state === stateType.DO_BALANCE) {
				doBalance(yawNumber, pitchNumber);
				selectHint();
			}
			if (state === stateType.START_ACTIONS && !isStart) {
				isStart = true;
				selectHint();
				startPreActionTimer();
			}

			if (isStart && step < 4 && randomNumberList.length === 4) {
				selectHint();
				checkAction(x.toFixed(2), y.toFixed(2));
			}
			if (step === 4 && isStart) {
				state = stateType.FINISHED;
				selectHint();
				isStart = false;
			}
			if (step === 4 && !isSending && randomNumberList.length === 4) {
				selectHint();
				isSending = true;
				timerEl.classList = timerEl.classList + " d-none";
				clearInterval(doActionInterval);
				setTimeout(function () {
					videoContainerEl.classList =
						videoContainerEl.classList + " isLoading";
					state = stateType.SENDING;

					selectHint();
					sendImage();
				}, 2000);
			}
		}
	};
	var isBalance = function (yawNumber, pitchNumber) {
		if (
			45 <= yawNumber &&
			yawNumber <= 55 &&
			45 <= pitchNumber &&
			pitchNumber <= 55
		) {
			state = stateType.ACTIONS;
		}
		state = stateType.BALANCE;
	};
	var showIndicator = function () {
		pitchGaugeEl.classList.remove("d-none");
		yawGaugeEl.classList.remove("d-none");
		state = stateType.DO_BALANCE;
	};
	var hideIndicator = function () {
		pitchGaugeEl.classList = pitchGaugeEl.classList + " d-none";
		yawGaugeEl.classList = yawGaugeEl.classList + " d-none";
	};
	var doBalance = function (yawNumber, pitchNumber) {
		var fixedYawNumber = yawNumber > 100 ? 100 : yawNumber < 0 ? 0 : yawNumber;
		var FixedPitchNumber =
			pitchNumber > 100 ? 100 : pitchNumber < 0 ? 0 : pitchNumber;
		yawPointerEl.style.left = fixedYawNumber + "%";
		pitchPointerEl.style.top = FixedPitchNumber + "%";

		if (40 <= yawNumber && yawNumber <= 50) {
			yawPointerEl.style.background = "green";
		} else {
			yawPointerEl.style.background = "white";
		}
		if (40 <= pitchNumber && pitchNumber <= 50) {
			pitchPointerEl.style.background = "green";
		} else {
			pitchPointerEl.style.background = "white";
		}
		if (!doBalancingInterval && doBalancingTimer === 0) {
			doBalancingInterval = setInterval(() => {
				if (doBalancingTimer === 10) {
					state = stateType.BALANCED;
					checkBalanceTimer = setTimeout(function () {
						state = stateType.START_ACTIONS;
						hideIndicator();
						timerEl.classList = timerEl.classList + " d-none";
					}, 1000);
					clearInterval(doBalancingInterval);
				} else {
					doBalancingTimer += 1;
					timerEl.classList.remove("d-none");
					timerEl.innerHTML = doBalancingTimer;
				}
			}, 1000);
		}
		if (
			45 <= yawNumber &&
			yawNumber <= 55 &&
			45 <= pitchNumber &&
			pitchNumber <= 55
		) {
			if (!checkBalanceTimer) {
				state = stateType.BALANCED;
				checkBalanceTimer = setTimeout(function () {
					state = stateType.START_ACTIONS;
					hideIndicator();
					timerEl.classList = timerEl.classList + " d-none";
					clearInterval(doBalancingInterval);
					doBalancingInterval = null;
					doBalancingTimer = 0;
				}, 1000);
			} else {
				clearTimeout(checkBalance);
			}
		}
	};
	var selectHint = function () {
		var stateHintEl = document.querySelectorAll("[data-hint=" + state + "]");
		var allHints = document.querySelectorAll("[data-hint]");
		allHints.forEach((element) => {
			if (
				element.className.split(" ").indexOf("d-none") === -1 &&
				stateHintEl[0] !== element
			) {
				element.classList = element.classList + " d-none";
			}
		});

		stateHintEl.forEach((element) => {
			if (element.className.split(" ").indexOf("d-none") >= 0) {
				element.classList.remove("d-none");
			}
		});
	};
	var startPreActionTimer = function () {
		var intervalTime = 5;
		startActionsTimerEl.classList.remove("d-none");
		startActionsTimerEl.innerHTML = intervalTime;
		var starterInterval = setInterval(() => {
			if (intervalTime === 1) {
				result = null;
				isStarted = true;
				createActions();
				takePhotoInterval = setInterval(takingPicture, 333);
				startActionsTimerEl.classList =
					startActionsTimerEl.classList + " d-none";
				clearInterval(starterInterval);
				startActionTimer();
			} else {
				intervalTime -= 1;
				startActionsTimerEl.innerHTML = intervalTime;
			}
		}, 1000);
	};
	var startActionTimer = function () {
		timerEl.innerHTML = 1;
		timerEl.classList.remove("d-none");
		if (!doActionInterval) {
			doActionInterval = setInterval(() => {
				if (doActionTimer === 25) {
					timerEl.classList = timerEl.classList + " d-none";
					clearInterval(doActionInterval);
					state = stateType.FAILED;
					document.querySelectorAll("[data-arrow]").forEach((el) => {
						if (el.className.split(" ").indexOf("d-none") === -1) {
							el.classList = el.classList + " d-none";
						}
					});
				} else {
					doActionTimer += 1;
					timerEl.innerHTML = doActionTimer;
				}
			}, 1000);
		}
	};
	var createActions = function () {
		var newNum = Math.random() * 3;
		if (
			randomNumberList.includes(newNum.toFixed()) &&
			randomNumberList.length < 4
		) {
			createActions();
		} else {
			randomNumberList.push(newNum.toFixed());
		}
		if (randomNumberList.length < 4) {
			createActions();
		} else {
			state = stateType[actionDic[randomNumberList[0]]];
		}
	};
	var takingPicture = function () {
		var context = canvasPhotoEl.getContext("2d");
		if (width && height) {
			canvasPhotoEl.width = videoWidth;
			canvasPhotoEl.height = videoHeight;
			context.drawImage(video, 0, 0, videoWidth, videoHeight);
			var data = canvasPhotoEl.toDataURL("image/jpeg");
			photoList.push(data);
			valueTableData.push({
				yaw: currentValues.yaw,
				pitch: currentValues.pitch,
				action: state,
			});
		} else {
			clearPhoto();
		}
	};
	var clearPhoto = function () {
		var context = canvas.getContext("2d");
		context.fillStyle = "#AAA";
		context.fillRect(0, 0, canvas.width, canvas.height);
		var data = canvas.toDataURL("image/png");
		photo.setAttribute("src", data);
	};
	var checkAction = function (yaw, pitch) {
		if (state === "right") {
			arrowRight.classList.remove("d-none");
			if (yaw < -0.4) {
				step += 1;
				state = stateType.EMPTY;
				setTimeout(() => {
					state = stateType[actionDic[randomNumberList[step]]];
				}, 1500);
				videoWrapperEl.classList =
					videoWrapperEl.classList + " right-action-done";
			}
		}
		if (state === "left") {
			arrowLeft.classList.remove("d-none");
			if (yaw > 0.4) {
				step += 1;
				state = stateType.EMPTY;
				setTimeout(() => {
					state = stateType[actionDic[randomNumberList[step]]];
				}, 1500);
				videoWrapperEl.classList =
					videoWrapperEl.classList + " left-action-done";
			}
		}
		if (state === "up") {
			arrowUp.classList.remove("d-none");
			if (pitch > 0.1) {
				step += 1;
				state = stateType.EMPTY;
				setTimeout(() => {
					state = stateType[actionDic[randomNumberList[step]]];
				}, 1500);
				videoWrapperEl.classList = videoWrapperEl.classList + " up-action-done";
			}
		}
		if (state === "down") {
			arrowDown.classList.remove("d-none");
			if (pitch < -0.45) {
				step += 1;
				state = stateType.EMPTY;
				setTimeout(() => {
					state = stateType[actionDic[randomNumberList[step]]];
				}, 1500);
				videoWrapperEl.classList =
					videoWrapperEl.classList + " down-action-done";
			}
		}
	};
	var urltoFile = function (url, filename, mimeType) {
		return fetch(url)
			.then(function (res) {
				return res.arrayBuffer();
			})
			.then(function (buf) {
				return new File([buf], filename, { type: mimeType });
			});
	};
	var sendImage = function () {
		const fixedFrames = {};
		photoList.forEach((frame, idx) => {
			fixedFrames[idx] = frame.split(",")[1];
		});
		var randomAction =
			actionDic[randomNumberList[0]] +
			"," +
			actionDic[randomNumberList[1]] +
			"," +
			actionDic[randomNumberList[2]] +
			"," +
			actionDic[randomNumberList[3]];
		urltoFile(photoList[0], "imagefile.jpeg", "image/jpeg").then(function (
			file
		) {
			var formData = new FormData();
			formData.append("image", file, "/path/to/file");
			formData.append("fps", "3");
			formData.append(
				"pose_action",
				randomAction
					.split(",")
					.map((act) => act.split("")[0])
					.join("")
			);
			formData.append(
				"values",
				JSON.stringify({
					minPitch: minPitch.toFixed(2),
					maxPitch: maxPitch.toFixed(2),
					minYaw: minYaw.toFixed(2),
					maxYaw: maxYaw.toFixed(2),
				})
			);
			formData.append("table", JSON.stringify([...valueTableData]));
			formData.append("id", new Date().getTime());
			formData.append("frames", JSON.stringify(fixedFrames));

			var requestOptions = {
				method: "POST",
				body: formData,
				redirect: "follow",
			};
			fetch("https://reg-api-test.emofid.com/api/ekyc", requestOptions)
				.then((response) => response.text())
				.then((res) => {
					result = JSON.parse(res);
				})
				.catch((error) => {
					console.log("faild");
					console.log("error", error);
				});
		});
	};
	var init = function () {
		webCam();
		selectHint();
	};
	init();
};

export default Jeeliz;
