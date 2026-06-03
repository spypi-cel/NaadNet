import json

class MQTTProcessor:

    @staticmethod
    def process(payload):

        data = json.loads(payload)

        return {
            "node":data["node"],
            "noise":data["noise"]
        }