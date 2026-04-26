import "@mikuexe/annotator-react/register";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SourceAnnotator } from "@mikuexe/annotator-react";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <SourceAnnotator
      onCollect={(payload) => {
        console.info("Collected annotations", payload);
      }}
    />
  </StrictMode>,
);
