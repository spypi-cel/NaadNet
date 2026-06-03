class HeatmapService:

    @staticmethod
    def create_heatmap(nodes):

        points = []

        for node in nodes:

            points.append(
                {
                    "lat":node.latitude,
                    "lng":node.longitude,
                    "value":node.noise_level
                }
            )

        return points