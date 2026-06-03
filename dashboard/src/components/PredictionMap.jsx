// PredictionMap is now integrated directly into Predictions.js
// This file is kept for backward compatibility
import HeatMap from "./HeatMap";

export default function PredictionMap({ points }) {
  return <HeatMap points={points} />;
}
