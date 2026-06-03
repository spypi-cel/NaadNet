import numpy as np

class IDWInterpolation:

    @staticmethod
    def interpolate(target_lat,
                    target_lng,
                    points):

        numerator = 0
        denominator = 0

        for p in points:

            distance = np.sqrt(
                (target_lat - p["lat"])**2 +
                (target_lng - p["lng"])**2
            )

            if distance == 0:
                return p["noise"]

            weight = 1 / distance

            numerator += (
                weight * p["noise"]
            )

            denominator += weight

        return numerator / denominator