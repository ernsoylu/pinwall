import { Creator } from "./routes/Creator";
import { Viewer } from "./routes/Viewer";

/** Two routes, so a router dependency would be all cost and no benefit. */
export function App() {
  const id = location.pathname.replace(/^\/+|\/+$/g, "");
  if (!id) return <Creator />;

  const editToken = location.hash.slice(1) || null;
  return <Viewer id={id} editToken={editToken} />;
}
