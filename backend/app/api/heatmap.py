from fastapi import APIRouter

router = APIRouter()

@router.get("/heatmap")

def heatmap():

    return [

        {
            "lat":17.385,
            "lng":78.486,
            "value":85
        },

        {
            "lat":17.412,
            "lng":78.502,
            "value":55
        }
    ]