from app.models import Metric


def to_celsius(value: float, metric: Metric) -> float:
    """Convert a reading to °C; Celsius values are returned as is."""
    return (value - 32) * 5 / 9 if metric is Metric.F else value


def from_celsius(value: float, metric: Metric) -> float:
    """Convert a °C value to the given metric (for filters and display)."""
    return value * 9 / 5 + 32 if metric is Metric.F else value
