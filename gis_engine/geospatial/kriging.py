import numpy as np

class KrigingInterpolation:

    @staticmethod
    def predict(points):

        values = [
            p["noise"]
            for p in points
        ]

        return np.mean(values)