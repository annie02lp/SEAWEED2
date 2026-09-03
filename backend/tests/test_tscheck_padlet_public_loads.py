"""Verifies the public Padlet board embedded by the feedback modal is reachable
and serves the expected board (OPINIONES DEL JUEGO SEAWEED).

This checks an external service (padlet.com), not our own FastAPI app -
intentional per the criterion "El Padlet público carga correctamente".
"""

import httpx

PADLET_URL = "https://padlet.com/tresazulxre23/opiniones-del-juego-seaweed-s0238bxxb1ij9a9vpgkf"


def test_padlet_board_responds_200_with_expected_title():
    resp = httpx.get(PADLET_URL, timeout=30.0, follow_redirects=True)
    assert resp.status_code == 200, f"Padlet board returned {resp.status_code}"
    body = resp.text
    assert "seaweed" in body.lower() or "opiniones" in body.lower(), (
        "Padlet board body did not mention seaweed/opiniones; excerpt: " + body[:300]
    )
