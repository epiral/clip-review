import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Review from "./pages/Review";
import DeckDetail from "./pages/DeckDetail";
import KPDetail from "./pages/KPDetail";
import Graph from "./pages/Graph";

function useHash() {
  const [hash, setHash] = useState(window.location.hash.slice(1) || "");
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1) || "");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();

  if (hash === "review") return <Review />;
  if (hash.startsWith("practice/")) return <Review kpId={hash.split("/")[1]} />;
  if (hash === "graph") return <Graph />;
  if (hash.startsWith("deck/")) return <DeckDetail />;
  if (hash.startsWith("kp/")) return <KPDetail />;
  return <Dashboard />;
}
