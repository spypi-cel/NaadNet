from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "NaadNet"
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883
    NOISE_THRESHOLD: float = 70.0
    POSTGRES_URL: str = "postgresql://naadnet:naadnet@localhost:5432/naadnet"
    DATABASE_URL: str = "sqlite:///./naadnet.db"

settings = Settings()
