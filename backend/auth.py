from fastapi import Request, HTTPException
from supabase_client import get_supabase


async def get_current_user(request: Request) -> str:
    """
    Extract and verify the Supabase JWT from the Authorization header.
    Returns the authenticated user_id.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionado")

    token = auth.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token vacío")

    try:
        supabase = get_supabase()
        user = supabase.auth.get_user(token)
        return user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
