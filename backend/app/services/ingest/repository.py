from sqlalchemy import select

from app.models import Fridge, Reader, Status
from app.services.ingest.registry import Registry
from app.services.ingest.schemas import ReadingIn, SaveResult


class ReadingRepository:
    """The single write path for readings."""

    def __init__(self, session, registry: Registry):
        """Keep the session and registry; new_readers collects the rows added by save_many."""
        self.session = session
        self.registry = registry
        self.new_readers: list[Reader] = []

    def save_many(self, readings: list[ReadingIn], result: SaveResult) -> SaveResult:
        """Add valid readings, skip duplicates, apply display renames; the caller commits.

        Args:
            readings: Validated rows.
            result: The upload result to add counts to.

        Returns:
            The same result, with inserted, duplicates, err_rows and renamed_fridges filled.
        """
        seen = self._existing_keys(readings)
        for reading in readings:
            key = (reading.logger, reading.time)
            if key in seen:
                result.duplicates += 1
                continue
            seen.add(key)
            reader = Reader(
                logger_id=reading.logger,
                time=reading.time,
                temp=reading.temp,
                metric=self.registry.loggers[reading.logger].metric,
                status=reading.status,
            )
            self.session.add(reader)
            self.new_readers.append(reader)
            result.inserted += 1
            result.err_rows += reading.status is Status.ERR
        result.renamed_fridges = self._apply_renames(readings)
        self.session.flush()
        return result

    def _existing_keys(self, readings: list[ReadingIn]) -> set:
        """(logger, time) pairs of these loggers already in the database."""
        loggers = {r.logger for r in readings}
        rows = self.session.execute(select(Reader.logger_id, Reader.time).where(Reader.logger_id.in_(loggers)))
        return {(logger_id, time) for logger_id, time in rows}

    def _apply_renames(self, readings: list[ReadingIn]) -> list[str]:
        """Rename a fridge when its logger's newest reading uses a new display name."""
        latest: dict[str, ReadingIn] = {}
        for reading in readings:
            if reading.logger not in latest or reading.time > latest[reading.logger].time:
                latest[reading.logger] = reading
        renamed = []
        for logger_id, reading in latest.items():
            info = self.registry.loggers[logger_id]
            fridge = self.session.get(Fridge, info.fridge_id)
            newer = fridge.last_measured is None or reading.time >= fridge.last_measured
            if reading.fridge != fridge.name and newer:
                renamed.append(f"{info.branch}: {fridge.name} -> {reading.fridge}")
                fridge.name = reading.fridge
        return renamed
