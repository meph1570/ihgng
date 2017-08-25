
dev:
	npm run dev

webext:
	npm run build

.PHONY: webext dev
.DEFAULT_GOAL := dev
