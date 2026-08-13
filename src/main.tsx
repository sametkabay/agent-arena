import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "@/styles/global.css";
import App from "@/App";
import { appConfig } from "@/lib/config";

document.title = appConfig.app.title;
const desc = document.querySelector('meta[name="description"]');
if (desc) desc.setAttribute("content", appConfig.app.description);
const theme = document.querySelector('meta[name="theme-color"]');
if (theme) theme.setAttribute("content", appConfig.app.themeColor);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
