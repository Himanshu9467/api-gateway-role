import AppRoutes from "./routes/AppRoutes";
import { useAuthBootstrap } from "./hooks/useAuthBootstrap";

export default function App() {
  useAuthBootstrap();
  return <AppRoutes />;
}
