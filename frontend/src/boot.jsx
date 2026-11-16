import { MotionConfig } from "motion/react";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./Shell.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(
	<MotionConfig reducedMotion="user">
		<App />
	</MotionConfig>,
);
