from typing import Annotated

from pydantic import BeforeValidator, Field

from app.services.ingest.normalizer import LOGGER_PATTERN, collapse_spaces

Name = Annotated[str, BeforeValidator(collapse_spaces), Field(min_length=1, max_length=100)]
BuildingNumber = Annotated[str, BeforeValidator(collapse_spaces), Field(min_length=1, max_length=20)]  # "12a"
LoggerId = Annotated[str, BeforeValidator(lambda v: collapse_spaces(v).upper()), Field(pattern=LOGGER_PATTERN)]
