import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ARTIFACT } from "./engine/engine.js";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/theme.css";

if (ARTIFACT) document.documentElement.classList.add("is-artifact");

createRoot(document.getElementById("root")).render(<App />);
