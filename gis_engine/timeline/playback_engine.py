import pandas as pd

class PlaybackEngine:

    @staticmethod
    def get_frame(
        dataframe,
        timestamp
    ):

        frame = dataframe[
            dataframe["timestamp"] == timestamp
        ]

        return frame.to_dict(
            orient="records"
        )