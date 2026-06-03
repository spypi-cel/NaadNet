import pandas as pd

class RealTimeHeatMap:

    @staticmethod
    def generate(nodes):

        heatmap_points = []

        for node in nodes:

            heatmap_points.append({
                "lat": node["lat"],
                "lng": node["lng"],
                "intensity": node["noise"]
            })

        return heatmap_points