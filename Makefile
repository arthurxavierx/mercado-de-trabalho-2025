BARCODES_CSV := barcodes.csv
LOCALHOST := localhost.pem
LOCALHOST_KEY := localhost-key.pem
SITE_PACKAGES = $(shell python3 -m pip show pip | grep '^Location' | cut -f2 -d':')
REQUIREMENTS_TXT = requirements.txt

PYTHON3 := python3
PIP := $(PYTHON3) -m pip

all: run

.PHONY: barcodes $(BARCODES_CSV)
barcodes: $(BARCODES_CSV:.csv=.pdf)

%.pdf: %.eps
	gs \
    -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -dSAFER \
    -dCompatibilityLevel="1.5" -dPDFSETTINGS="/printer" \
    -dSubsetFonts=true -dEmbedAllFonts=true \
    -sPAPERSIZE=a3 -sOutputFile=$@ \
    -c "<</BeginPage{1.414 1.414 scale}>> setpagedevice" \
    -f $<

%.eps: %.csv
	$(PYTHON3) check.py < $< | cut -d ',' -f1 | barcode -u mm -p 210x297 -g 42x21 -t 3x7 -m 11 -e ean13 -o $@

.PHONY: freeze
freeze:
	$(PIP) freeze > $(REQUIREMENTS_TXT)

.PHONY: install
install: $(SITE_PACKAGES)

.PHONY: run
run: $(BARCODES_CSV) | $(SITE_PACKAGES)
	$(PYTHON3) server.py --cert-file $(LOCALHOST) --key-file $(LOCALHOST_KEY) < $<

$(SITE_PACKAGES): $(REQUIREMENTS_TXT)
	$(PIP) install -r $<

$(REQUIREMENTS_TXT):
	$(PIP) freeze > $@
