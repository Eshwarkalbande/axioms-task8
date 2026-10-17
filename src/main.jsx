import React from "react";
import { createRoot } from "react-dom/client";
import SalaryCalculator from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SalaryCalculator />
  </React.StrictMode>,
);
