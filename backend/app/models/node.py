from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class NoiseNode(Base):

    __tablename__ = "noise_nodes"

    id = Column(Integer, primary_key=True)

    node_id = Column(String)

    latitude = Column(Float)

    longitude = Column(Float)

    noise_level = Column(Float)