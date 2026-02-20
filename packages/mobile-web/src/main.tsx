import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MobileI18nProvider } from "./i18n/provider";
import "./styles.css";

export function mountMobileWeb(rootElementId = "root"): void {
  const root = document.getElementById(rootElementId);

  if (!root) {
    throw new Error(`Missing root element: #${rootElementId}`);
  }

  ReactDOM.createRoot(root).render(
    <MobileI18nProvider>
      <App />
    </MobileI18nProvider>,
  );
}
