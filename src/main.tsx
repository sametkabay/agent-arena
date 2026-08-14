import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "@/styles/global.css";
import App from "@/App";
import { appConfig } from "@/lib/config";

document.title = appConfig.app.title;
const desc = appConfig.app.description;
for (const selector of [
  'meta[name="description"]',
  'meta[property="og:description"]',
  'meta[name="twitter:description"]',
]) {
  document.querySelector(selector)?.setAttribute("content", desc);
}
for (const selector of [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
]) {
  document.querySelector(selector)?.setAttribute("content", appConfig.app.title);
}
const theme = document.querySelector('meta[name="theme-color"]');
if (theme) theme.setAttribute("content", appConfig.app.themeColor);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
