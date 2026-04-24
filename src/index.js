import React from "react";
import ReactDOM from "react-dom/client";

import InputURL from "./components/InputURL";
function App() {
    return (
        <>
            <InputURL />

        </>
    )
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);