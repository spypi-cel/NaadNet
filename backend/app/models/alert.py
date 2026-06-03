from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Alert(Base):

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)

    level = Column(String)

    message = Column(String)