"""Server entrypoint: `python -m app`. Host and port come from BEE_API_HOST / BEE_API_PORT."""

import uvicorn

from app.core.config import Settings, get_settings
from app.main import create_app


def main(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    uvicorn.run(
        create_app(settings),
        host=settings.api_host,
        port=settings.api_port,
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
