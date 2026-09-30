from datetime import datetime

import pytest

from app.services.ingest.normalizer import collapse_spaces, parse_temp, parse_time

SIX_AM = datetime(2026, 9, 14, 6, 0)


def test_both_date_formats_from_the_sample_give_the_same_time():
    """The Haifa logger's DD/MM/YYYY and the others' YYYY-MM-DD mean the same moment."""
    assert parse_time("2026-09-14 06:00") == SIX_AM
    assert parse_time("14/09/2026 06:00") == SIX_AM


def test_excel_datetime_cell_is_accepted():
    """A cell Excel already stores as a datetime is used as is."""
    assert parse_time(SIX_AM) == SIX_AM


@pytest.mark.parametrize("bad", ["32/09/2026 06:00", "14-09-26", "", None])
def test_malformed_dates_are_rejected(bad):
    """Impossible or unknown date formats raise a ValueError."""
    with pytest.raises(ValueError):
        parse_time(bad)


def test_err_means_no_temperature_and_numbers_are_kept_as_given():
    """ERR (any case, any spaces) has no temperature; numbers are not converted."""
    assert parse_temp("ERR") is None
    assert parse_temp(" err ") is None
    assert parse_temp("4.1") == 4.1
    assert parse_temp(38.3) == 38.3


@pytest.mark.parametrize("bad", ["abc", "", None])
def test_non_numeric_temperatures_are_rejected(bad):
    """Text that is neither a number nor ERR raises a ValueError."""
    with pytest.raises(ValueError):
        parse_temp(bad)


def test_names_with_extra_spaces_are_collapsed():
    """Leading, trailing and doubled spaces are removed."""
    assert collapse_spaces("  tel   aviv ") == "tel aviv"
