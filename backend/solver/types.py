from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class SurgeonType(str, Enum):
    EGS = 'EGS'
    NON_EGS = 'NON_EGS'
    POOL = 'POOL'


class BlackoutType(str, Enum):
    OCD = 'OCD'
    OCN = 'OCN'
    BOTH = 'BOTH'


class ShiftKind(str, Enum):
    OCD = 'OCD'
    OCN = 'OCN'
    EGS = 'EGS'
    H24 = '24H'


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BlackoutDate(_CamelModel):
    date: str
    type: BlackoutType


class RobotBlock(_CamelModel):
    date: str
    assisting_only: bool = False


class SurgeonPreferences(_CamelModel):
    shift_preference: str = 'none'
    custom_notes: str = ''


class Surgeon(_CamelModel):
    id: str
    name: str
    type: SurgeonType
    blackouts: List[BlackoutDate] = []
    robot_blocks: List[RobotBlock] = []
    preferences: SurgeonPreferences = Field(default_factory=SurgeonPreferences)
    available_dates: Optional[List[str]] = None


class Shift(_CamelModel):
    id: str
    surgeon_id: str
    date: str
    kind: ShiftKind
    end_date: Optional[str] = None
    ancillaries: Optional[List[str]] = None
    pinned: Optional[bool] = None


class DateRange(BaseModel):
    start: str
    end: str


class GenerateRequest(_CamelModel):
    surgeons: List[Surgeon]
    range_: DateRange = Field(alias='range')
    existing_shifts: Optional[List[Shift]] = None


class GenerateResponse(BaseModel):
    shifts: List[Shift]

    def to_camel_dict(self) -> dict:
        return {
            'shifts': [
                s.model_dump(by_alias=True, mode='json')
                for s in self.shifts
            ]
        }
