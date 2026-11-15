import os
import sys
import hashlib
import urllib.request
import time

URL = "https://data.mendeley.com/public-files/datasets/fdfftr3tc2/files/fff037a3-d0e4-496f-92f7-5c5820a734f1/file_downloaded"
EXPECTED_SHA256 = "d020a7352af89b72a9fd843ab9990e68db9333221c49b26925356c444465d7b0"
DEST_FILE = os.path.join("data", "Database.csv")

def download_file(url, dest_path):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    temp_path = dest_path + ".tmp"
    
    print(f"Downloading dataset from: {url}")
    print(f"Destination: {dest_path}")
    
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Batch9-ML-Project/1.0"}
    )
    
    start_time = time.time()
    last_print = start_time
    total_bytes = 0
    
    with urllib.request.urlopen(req) as response, open(temp_path, "wb") as out_file:
        content_length = response.headers.get("Content-Length")
        total_size = int(content_length) if content_length else None
        
        while True:
            chunk = response.read(1024 * 1024) # 1MB chunks
            if not chunk:
                break
            out_file.write(chunk)
            total_bytes += len(chunk)
            
            now = time.time()
            if now - last_print > 3.0:
                if total_size:
                    pct = (total_bytes / total_size) * 100
                    print(f"Downloaded {total_bytes / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB ({pct:.1f}%)")
                else:
                    print(f"Downloaded {total_bytes / (1024*1024):.1f} MB")
                last_print = now
                
    elapsed = time.time() - start_time
    print(f"Download complete: {total_bytes / (1024*1024):.2f} MB in {elapsed:.1f}s ({total_bytes / (1024*1024*max(elapsed, 0.001)):.2f} MB/s)")
    
    if os.path.exists(dest_path):
        os.remove(dest_path)
    os.rename(temp_path, dest_path)

def verify_checksum(filepath, expected_sha256):
    print(f"Verifying SHA-256 for {filepath}...")
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(1024 * 1024), b""):
            sha256_hash.update(byte_block)
    actual_hash = sha256_hash.hexdigest().lower()
    print(f"Calculated SHA-256: {actual_hash}")
    print(f"Expected   SHA-256: {expected_sha256.lower()}")
    if actual_hash == expected_sha256.lower():
        print("SHA-256 CHECKSUM VERIFIED! MATCH CONFIRMED.")
        return True
    else:
        print("ERROR: SHA-256 checksum mismatch!")
        return False

if __name__ == "__main__":
    if os.path.exists(DEST_FILE):
        print(f"File {DEST_FILE} already exists. Verifying SHA-256...")
        if verify_checksum(DEST_FILE, EXPECTED_SHA256):
            print("Existing file is valid. No download needed.")
            sys.exit(0)
        else:
            print("Existing file is corrupt or incomplete. Re-downloading...")
            
    download_file(URL, DEST_FILE)
    if not verify_checksum(DEST_FILE, EXPECTED_SHA256):
        sys.exit(1)
    print("Dataset ready.")

