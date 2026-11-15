import os
import sys

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn

if __name__ == "__main__":
    print("=" * 70)
    print("BATCH 9 • RENEWABLE ENERGY PATTERN DISCOVERY")
    print("SRM Institute of Science & Technology • CTECH Department")
    print("=" * 70)
    print("Serving Unified Application at: http://127.0.0.1:8000")
    print("Press CTRL+C to stop the server.")
    print("=" * 70)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="info")

