import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { logError } from "./lib/logError";

window.addEventListener("error", (e) => {
  void logError(e.message, { feature: "window", details: e.error ?? e.filename });
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  void logError(reason?.message ?? String(reason), { feature: "promise", details: reason });
});

createRoot(document.getElementById("root")!).render(<App />);
