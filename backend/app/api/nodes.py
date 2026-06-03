from fastapi import APIRouter

router = APIRouter()

@router.get("/nodes")
def get_nodes():

    return [
        {
            "id":"N001",
            "lat":17.385,
            "lng":78.486,
            "noise":65
        }
    ]