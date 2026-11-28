import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "@fontsource-variable/karla/wght.css";
import "@fontsource-variable/karla/wght-italic.css";
import "@fontsource-variable/nunito/wght.css";
import "@fontsource-variable/nunito/wght-italic.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
