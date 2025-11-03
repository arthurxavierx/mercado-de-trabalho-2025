#!.venv/bin/python3
import ean13
import sys

# Calculate the EAN-13 barcode check digit for all unchecked barcodes (one per
# line) in the standard input. The input barcodes should be EAN-13 barcodes
# without the verification digit.
for line in sys.stdin:
    unchecked_code, *data = line.split(",")
    code = ean13.check(unchecked_code)
    print(f"{code},{",".join(data).rstrip()}")
