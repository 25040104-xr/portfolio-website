import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// A free host puts the contact-form server to sleep when nobody uses it.
// Waking it as soon as the site opens means it is ready by the time a visitor reaches Contact.
fetch("/api/health").catch(() => {});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);