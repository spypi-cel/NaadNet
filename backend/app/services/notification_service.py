class NotificationService:

    @staticmethod
    def create_alert(noise):

        if noise > 85:

            return {
                "status":"danger",
                "message":"High noise detected"
            }

        return None