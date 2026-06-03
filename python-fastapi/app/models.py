from typing import Literal, Optional

from pydantic import BaseModel, field_validator

Status = Literal["pending", "in_progress", "done"]
Priority = Literal["low", "medium", "high"]


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Status = "pending"
    priority: Priority = "medium"
    project_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("title is required and must be a non-empty string")
        if len(v) > 255:
            raise ValueError("title must be <= 255 chars")
        return v.strip()


class TaskUpdate(BaseModel):
    # All optional — a PUT updates only the provided fields (see exclude_unset).
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    project_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: Optional[str]) -> Optional[str]:
        # Reject an explicitly-provided null/blank title (title is NOT NULL).
        if v is None or not v.strip():
            raise ValueError("title must be a non-empty string")
        if len(v) > 255:
            raise ValueError("title must be <= 255 chars")
        return v.strip()
