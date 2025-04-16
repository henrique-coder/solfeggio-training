PYTHON ?= python
VENV := .venv

FIRST_TARGET := $(firstword $(MAKECMDGOALS))
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))

.PHONY: lint format help %
.DEFAULT_GOAL := help

lint:
	npx prettier --check .

format:
	npx prettier --write .

help:
	@echo "Available commands:"
	@echo "  lint        - Check code with Prettier"
	@echo "  format      - Format code with Prettier"
	@echo "  help        - Show this help message"

%:
	@if [ "$(FIRST_TARGET)" = "install" ]; then \
		:; \
	else \
		@echo "make: *** Unknown target '$@'. Use 'make help' for available targets." >&2; \
		exit 1; \
	fi
