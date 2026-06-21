from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from solver.types import GenerateRequest
from solver.model import solve_schedule

app = FastAPI(title='Scheduler API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['GET', 'POST', 'OPTIONS'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/generate')
def generate(request: GenerateRequest):
    try:
        result = solve_schedule(request)
        return JSONResponse(content=result.to_camel_dict())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Solver error: {str(e)}')
