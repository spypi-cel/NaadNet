class ForecastHeatMap:

    @staticmethod
    def generate(predictions):

        forecast_points = []

        for item in predictions:

            forecast_points.append({
                "lat": item["lat"],
                "lng": item["lng"],
                "future_noise": item["predicted_noise"]
            })

        return forecast_points