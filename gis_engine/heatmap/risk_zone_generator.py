class RiskZoneGenerator:

    @staticmethod
    def generate(nodes):

        zones = []

        for node in nodes:

            if node["noise"] > 85:

                zones.append({

                    "lat": node["lat"],

                    "lng": node["lng"],

                    "risk": "HIGH"
                })

        return zones