class TimeSlider:

    @staticmethod
    def build_timeline(data):

        unique_times = sorted(
            list(
                set(
                    data["timestamp"]
                )
            )
        )

        return unique_times