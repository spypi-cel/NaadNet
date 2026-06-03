import math

class NoiseRadiation:

    @staticmethod
    def calculate_radius(noise_level):

        if noise_level < 40:
            return 50

        elif noise_level < 60:
            return 150

        elif noise_level < 80:
            return 300

        return 500

    @staticmethod
    def generate(node):

        return {
            "lat": node["lat"],
            "lng": node["lng"],
            "radius":
            NoiseRadiation.calculate_radius(
                node["noise"]
            ),
            "noise": node["noise"]
        }