import numpy as np

class PredictionService:

    @staticmethod
    def predict(values):

        avg = np.mean(values)

        prediction = avg + 3

        return round(prediction,2)