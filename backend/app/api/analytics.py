from fastapi import APIRouter

router = APIRouter()

@router.get("/analytics")

def analytics():

    return {

        "average":68,

        "max":92,

        "min":31
    }