from difflib import get_close_matches

from pydantic import BaseModel

from app.services.ingest.normalizer import collapse_spaces
from app.services.ingest.registry import Registry


class UnknownBranch(BaseModel):
    """A branch name in the file that is not registered, with the closest registered name."""

    name: str
    suggestion: str | None = None


class UnknownLogger(BaseModel):
    """A logger id in the file that is not registered; no suggestion, similar ids are different loggers."""

    logger: str
    branch: str
    fridge: str


class UnknownEntries(BaseModel):
    """Unregistered branches and loggers the user can add, each listed once."""

    branches: list[UnknownBranch] = []
    loggers: list[UnknownLogger] = []


def _closest(value: str, candidates) -> str | None:
    """The most similar candidate with similarity >= 0.8, or None."""
    match = get_close_matches(value, list(candidates), n=1, cutoff=0.8)
    return match[0] if match else None


def find_unknown(failed: list[tuple[dict, set[str]]], registry: Registry) -> UnknownEntries | None:
    """Collect the unknown branches and loggers of the rejected rows.

    Args:
        failed: Each rejected row's raw values with the Pydantic error types it raised.
        registry: The registered data the rows were checked against.

    Returns:
        The unknown entries, or None when there are none.
    """
    result, seen = UnknownEntries(), set()
    for values, error_types in failed:
        branch = collapse_spaces(values.get("branch"))
        if "unknown_branch" in error_types and branch.lower() not in seen:
            seen.add(branch.lower())
            hit = _closest(branch.lower(), registry.branches)
            result.branches.append(UnknownBranch(name=branch, suggestion=registry.branches.get(hit)))
        logger = collapse_spaces(values.get("logger")).upper()
        if "unknown_logger" in error_types and logger not in seen:
            seen.add(logger)
            result.loggers.append(UnknownLogger(
                logger=logger,
                branch=registry.branches.get(branch.lower(), branch),
                fridge=collapse_spaces(values.get("fridge")),
            ))
    return result if result.branches or result.loggers else None
