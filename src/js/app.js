import "../scss/app.scss";
import "regenerator-runtime/runtime";

/* Your JS Code goes here */
import human from "./human";

if (document.location.href.includes("human")) {
	human();
}
