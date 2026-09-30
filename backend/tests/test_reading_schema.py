from datetime import datetime

import pytest
from pydantic import ValidationError

from app.errors import field_errors
from app.models import Metric, Status
from app.services.ingest.registry import LoggerInfo, Registry
from app.services.ingest.schemas import ReadingIn

REGISTRY = Registry(
    branches={"jerusalem": "Jerusalem", "tel aviv": "Tel Aviv", "haifa": "Haifa"},
    loggers={
        "TL-0512": LoggerInfo(1, "Jerusalem", "Dairy", Metric.C),
        "TL-0417": LoggerInfo(2, "Tel Aviv", "Walk-in", Metric.C),
        "TL-0231": LoggerInfo(3, "Haifa", "Dairy", Metric.F),
    },
    fridges={("jerusalem", "dairy"): 1, ("tel aviv", "walk-in"): 2, ("haifa", "dairy"): 3, ("tel aviv", "display 1"): 4},
)


def validate(**row) -> ReadingIn:
    """Validate a Jerusalem Dairy row with the given fields replaced."""
    base = {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "2026-09-14 06:00", "temp": 3.8}
    return ReadingIn.model_validate({**base, **row}, context={"registry": REGISTRY})


def error_fields(**row) -> dict[str, str]:
    """Validate a row that must fail and return its errors as {field: message}."""
    with pytest.raises(ValidationError) as exc:
        validate(**row)
    return {e.field: e.message for e in field_errors(exc.value)}


def errors_of(**row) -> list[tuple[str, str]]:
    """Validate a row that must fail and return its errors as [(field, error type)]."""
    with pytest.raises(ValidationError) as exc:
        validate(**row)
    return [(".".join(map(str, e["loc"])), e["type"]) for e in exc.value.errors()]


def test_lowercase_branch_and_fridge_become_the_stored_names():
    """"tel aviv" / "walk-IN" are stored as the registered "Tel Aviv" / "Walk-in"."""
    reading = validate(logger="TL-0417", branch="tel aviv", fridge="walk-IN")

    assert (reading.branch, reading.fridge) == ("Tel Aviv", "Walk-in")


def test_haifa_row_keeps_its_fahrenheit_value_and_parses_the_day_first_date():
    """39.0 stays 39.0 (°F is converted only for display and rules) and DD/MM/YYYY is parsed."""
    reading = validate(logger="TL-0231", branch="Haifa", time="14/09/2026 06:15", temp=39.0)

    assert (reading.time, reading.temp, reading.status) == (datetime(2026, 9, 14, 6, 15), 39.0, Status.OK)


def test_err_row_is_valid_with_no_temperature():
    """An ERR reading is accepted with status ERR and no temperature."""
    reading = validate(logger="TL-0231", branch="Haifa", temp="ERR")

    assert (reading.temp, reading.status) == (None, Status.ERR)


def test_new_fridge_name_for_a_known_logger_is_a_display_rename():
    """TL-0417 reporting from "Display 2" is the same fridge under a new display name."""
    assert validate(logger="TL-0417", branch="Tel Aviv", fridge="Display 2").fridge == "Display 2"


def test_unknown_branch_bad_logger_id_bad_date_and_bad_temp_are_reported_per_field():
    """Every invalid field of a row is reported, not only the first."""
    errors = error_fields(logger="TL-51", branch="Eilat", time="32/09/2026 06:00", temp="abc")

    assert errors == {
        "logger": "Logger id must match TL-NNNN",
        "branch": "Unknown branch name",
        "time": "Unrecognized date '32/09/2026 06:00'. Use YYYY-MM-DD HH:MM or DD/MM/YYYY HH:MM",
        "temp": "Temperature must be a number or ERR",
    }


def test_unregistered_logger_is_rejected():
    """A well-formed logger id that is not registered is an unknown logger."""
    assert error_fields(logger="TL-9999") == {"logger": "Unknown logger"}


def test_logger_from_another_branch_is_rejected():
    """A known logger reported under the wrong branch is rejected."""
    assert error_fields(logger="TL-0417", branch="Jerusalem") == {"branch": "Logger TL-0417 belongs to branch Tel Aviv"}


def test_fridge_name_of_another_logger_is_rejected():
    """A logger cannot take the name of a fridge that has a different logger."""
    errors = error_fields(logger="TL-0417", branch="Tel Aviv", fridge="Display 1")

    assert errors == {"fridge": "Fridge 'Display 1' uses another logger"}


def test_names_and_logger_ids_match_in_any_case_and_spacing():
    """" tl-0417 " / "TEL   AVIV" / " WALK-IN " match the registered logger, branch and fridge."""
    reading = validate(logger=" tl-0417 ", branch="TEL   AVIV", fridge=" WALK-IN ")

    assert (reading.logger, reading.branch, reading.fridge) == ("TL-0417", "Tel Aviv", "Walk-in")


def test_unknown_logger_with_a_new_fridge_is_flagged_for_registration():
    """A new logger with a new fridge name is only an unknown logger, so the user can add both."""
    assert errors_of(logger="TL-0600", fridge="Freezer") == [("logger", "unknown_logger")]


def test_unknown_branch_is_flagged_for_registration():
    """An unregistered branch is reported as unknown_branch, never created silently."""
    assert errors_of(branch="Eilat") == [("branch", "unknown_branch")]


@pytest.mark.parametrize("value", ["", None])
@pytest.mark.parametrize(
    "field, message",
    [
        ("logger", "Logger id is required"),
        ("branch", "Branch is required"),
        ("fridge", "Fridge name is required"),
        ("time", "Time is required"),
        ("temp", "Temperature is required"),
    ],
)
def test_empty_field_is_reported_as_required(field, message, value):
    """An empty cell is a row error for that field only, and is never offered for registration."""
    assert error_fields(**{field: value}) == {field: message}


def test_missing_field_in_a_single_record_is_reported():
    """A JSON record without "temp" gets Pydantic's "Field required"."""
    row = {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "2026-09-14 06:00"}

    with pytest.raises(ValidationError) as exc:
        ReadingIn.model_validate(row, context={"registry": REGISTRY})

    assert {e.field: e.message for e in field_errors(exc.value)} == {"temp": "Field required"}
