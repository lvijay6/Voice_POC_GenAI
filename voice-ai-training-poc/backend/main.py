"""
FastAPI backend for Voice AI Training POC.

Responsibilities:
- Load environment variables from .env if present (python-dotenv)
- Validate OPENAI_API_KEY at startup; refuse to start if missing
- Expose POST /session that proxies to OpenAI's Realtime sessions endpoint
- Apply CORS middleware restricted to the configured frontend origin
"""

import os
import sys

from dotenv import load_dotenv

# Load .env file from the same directory as this script, if it exists.
load_dotenv()

# ---------------------------------------------------------------------------
# Startup validation — fail fast before the app is constructed so that
# uvicorn exits cleanly with a clear error message.
# ---------------------------------------------------------------------------
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
if not OPENAI_API_KEY:
    print(
        "ERROR: OPENAI_API_KEY environment variable is not set. "
        "Set it in your shell or in a backend/.env file and restart the server.",
        file=sys.stderr,
    )
    raise RuntimeError(
        "OPENAI_API_KEY is required but was not found in the environment."
    )

FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Voice AI Training POC — Backend")

# CORS: only the configured frontend origin is allowed.
# OPTIONS must be included so the browser preflight succeeds before the POST.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)

# ---------------------------------------------------------------------------
# POST /session
# ---------------------------------------------------------------------------
OPENAI_SESSIONS_URL = "https://api.openai.com/v1/realtime/sessions"
OPENAI_SESSION_PAYLOAD = {
    "model": "gpt-4o-realtime-preview-2024-10-01",
    "voice": "alloy",
}


@app.post("/session")
async def create_session() -> JSONResponse:
    """
    Proxy a session-creation request to the OpenAI Realtime API.

    On success (2xx from OpenAI): return the full JSON response with HTTP 200.
    On upstream error: return HTTP 502 with a JSON detail message.
    The OPENAI_API_KEY is never included in any response body.
    """
    async with httpx.AsyncClient() as client:
        try:
            upstream = await client.post(
                OPENAI_SESSIONS_URL,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=OPENAI_SESSION_PAYLOAD,
                timeout=15.0,
            )
        except httpx.RequestError as exc:
            # Network-level error (DNS failure, connection refused, timeout, …)
            return JSONResponse(
                status_code=502,
                content={
                    "detail": f"Failed to create OpenAI session: {exc}"
                },
            )

        if upstream.is_success:
            return JSONResponse(status_code=200, content=upstream.json())

        # Upstream returned a non-2xx status — extract a readable message.
        try:
            error_body = upstream.json()
            message = error_body.get("error", {}).get("message") or upstream.text
        except Exception:
            message = upstream.text or str(upstream.status_code)

        return JSONResponse(
            status_code=502,
            content={
                "detail": f"Failed to create OpenAI session: {message}"
            },
        )
