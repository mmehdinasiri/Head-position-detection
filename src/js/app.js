import "../scss/app.scss";
import "regenerator-runtime/runtime";

const page = location.pathname
	.substring(location.pathname.lastIndexOf("/") + 1)
	.split(".")[0];

if (page !== "index")
	import(`./${page}`).then((run) => {
		run.default();
	});
// import Jeeliz from "./JeelizFaceFilter";
// Jeeliz();
