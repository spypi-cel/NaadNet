from fastapi import APIRouter

router = APIRouter()

@router.get("/predictions")

def predictions():

    return {

        "next_10_min":72,

        "next_1_hour":75,

        "next_24_hour":67
    }