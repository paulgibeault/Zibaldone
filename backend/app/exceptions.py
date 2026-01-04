from typing import Any, Dict, Optional

class AppError(Exception):
    """Base class for all application errors."""
    def __init__(
        self, 
        message: str, 
        code: str = "INTERNAL_ERROR", 
        status_code: int = 500, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

class ResultNotFound(AppError):
    """Raised when a requested resource is not found."""
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="NOT_FOUND", status_code=404, details=details)

class ServiceUnavailable(AppError):
    """Raised when an external service (S3, LLM) is unavailable."""
    def __init__(self, message: str = "Service unavailable", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="SERVICE_UNAVAILABLE", status_code=503, details=details)

class AuthenticationError(AppError):
    """Raised when authentication fails."""
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="AUTHENTICATION_FAILED", status_code=401, details=details)

class PermissionError(AppError):
    """Raised when the user does not have permission."""
    def __init__(self, message: str = "Permission denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="PERMISSION_DENIED", status_code=403, details=details)

class ValidationError(AppError):
    """Raised when validation fails."""
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="VALIDATION_FAILED", status_code=422, details=details)
