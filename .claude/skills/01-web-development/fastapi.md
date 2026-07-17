<!--
Merged from:
- ECC-main/.kiro/skills/fastapi-patterns/SKILL.md
-->

# FastAPI Patterns

Production-oriented patterns for FastAPI services.

## When to Use

- Building or reviewing a FastAPI app
- Splitting routers, schemas, dependencies, and database access
- Writing async endpoints that call a database or external service
- Adding authentication, authorization, OpenAPI docs, tests, or deployment settings

---

## How It Works

Treat the FastAPI app as a thin HTTP layer over explicit dependencies and service code:

- `main.py` owns app construction, middleware, exception handlers, and router registration
- `schemas/` owns Pydantic request and response models
- `dependencies.py` owns database, auth, pagination, and request-scoped dependencies
- `services/` owns business and persistence operations
- `tests/` overrides dependencies instead of opening production resources

---

## Project Layout

```text
app/
|-- main.py
|-- config.py
|-- dependencies.py
|-- exceptions.py
|-- api/
|   `-- routes/
|       |-- users.py
|       `-- health.py
|-- core/
|   |-- security.py
|   `-- middleware.py
|-- db/
|   |-- session.py
|   `-- crud.py
|-- models/
|-- schemas/
`-- tests/
```

---

## Application Factory

Use a factory so tests and workers can build the app with controlled settings:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    register_exception_handlers(app)
    app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
    return app
```

---

## Pydantic Schemas

Keep request, update, and response models separate:

```python
class UserBase(BaseModel):
    email: EmailStr
    full_name: Annotated[str, Field(min_length=1, max_length=100)]

class UserCreate(UserBase):
    password: Annotated[str, Field(min_length=12, max_length=128)]

class UserUpdate(BaseModel):
    email: EmailStr | None = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
```

---

## Dependencies

Use dependency injection for request-scoped resources:

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_db() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token)
    user = await db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user
```

---

## Async Endpoints

Keep route handlers async when they perform I/O:

```python
@router.get("/", response_model=list[UserResponse])
async def list_users(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all()
```

---

## Error Handling

Centralize domain exceptions and keep response shapes stable:

```python
class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
```

---

## Testing

Override the dependency used by `Depends`, not an internal helper:

```python
@pytest.fixture
async def client(test_session: AsyncSession):
    app = create_app()

    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

---

## Security Checklist

- Hash passwords with `argon2-cffi`, `bcrypt`, or passlib
- Validate JWT issuer, audience, expiry, and signing algorithm
- Keep CORS origins environment-specific
- Put rate limits on auth and write-heavy endpoints
- Use Pydantic models for all request bodies
- Use ORM parameter binding; never build SQL with f-strings
- Redact tokens, auth headers, and passwords from logs
- Run dependency audit in CI

---

## Performance Checklist

- Configure database connection pooling explicitly
- Add pagination to list endpoints
- Watch for N+1 queries; use eager loading
- Use async HTTP/database clients in async paths
- Add compression after checking CPU tradeoffs
- Cache stable expensive reads with invalidation

---

## Quick Reference

| Pattern | Description |
|---------|-------------|
| Factory | configure middleware and routers once |
| Schema split | separate Create/Update/Response models |
| Dependency override | tests override `get_db` directly |
| Async handlers | use async libraries for I/O |
| OpenAPI | assign `app.openapi = custom_openapi` |