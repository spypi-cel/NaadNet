from fastapi import APIRouter

router = APIRouter()

@router.get("/alerts")
def alerts():

    return [
        {
            "level":"warning",
            "message":"Noise exceeded limit"
        }
    ]