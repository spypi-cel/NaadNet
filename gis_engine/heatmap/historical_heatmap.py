import pandas as pd

class HistoricalHeatMap:

    @staticmethod
    def generate(dataframe, start_time, end_time):

        filtered = dataframe[
            (dataframe["timestamp"] >= start_time) &
            (dataframe["timestamp"] <= end_time)
        ]

        result = []

        for _, row in filtered.iterrows():

            result.append({
                "lat": row["lat"],
                "lng": row["lng"],
                "intensity": row["noise"]
            })

        return result