"""
Shared API error type.

Lives in its own module so both the service layer (network.py) and the
media module can raise it without circular imports.
"""


class ApiError(Exception):
    """An error the API layer should answer with `status` + message."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
