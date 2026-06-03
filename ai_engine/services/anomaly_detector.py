import numpy as np

def detect_anomaly(
    current_noise,
    historical_average
):

    diff = abs(
        current_noise -
        historical_average
    )

    if diff > 20:

        return True

    return False