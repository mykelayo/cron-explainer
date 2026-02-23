import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing    from "./Landing.jsx";
import Docs       from "./Docs.jsx";
import Scheduler  from "./Scheduler.jsx";
import CronTerms  from "./CronTerms.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Landing />} />
        <Route path="/docs"      element={<Docs />} />
        <Route path="/scheduler" element={<Scheduler />} />
        <Route path="/terms"     element={<CronTerms />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
