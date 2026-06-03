import { BrowserRouter } from "react-router-dom";
import RoutesConfig from "./routes";
import { AppProvider } from "./context";

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <RoutesConfig />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;