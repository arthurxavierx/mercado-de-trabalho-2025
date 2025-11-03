import sys

from pipe import filter, izip, map, reverse

def weights():
    while True:
        yield 3
        yield 1

def check(unchecked_code):
    checksum = sum(
        list(unchecked_code)
        | reverse
        | map(int)
        | izip(weights())
        | map(lambda x: x[0] * x[1])
    )
    check = (10 - (checksum % 10)) % 10
    return unchecked_code + str(check)
