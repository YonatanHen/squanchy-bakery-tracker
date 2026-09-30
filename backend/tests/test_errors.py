def test_unknown_api_url_returns_json_404(client, auth_headers):
    """A wrong API path gives the UI a JSON error, not an HTML page."""
    response = client.get("/api/v1/no-such-route", headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {"error": "Not found"}
