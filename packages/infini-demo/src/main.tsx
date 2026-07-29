import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { initializeInfini } from "@infini-scroll/core";

import { App } from "./App.js";
import "./styles.css";

const rootElement = document.querySelector<HTMLDivElement>("#root");
if (!rootElement) throw new Error("Missing #root element");

const root = createRoot(rootElement);

void initializeInfini()
    .then(() => {
        root.render(
            <StrictMode>
                <App />
            </StrictMode>,
        );
    })
    .catch((error: unknown) => {
        const message =
            error instanceof Error ? error.message : "Unknown startup error";
        root.render(
            <main className="startup-error">
                <h1>Infini could not start</h1>
                <p>{message}</p>
            </main>,
        );
    });
