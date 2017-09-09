
globals.json:
	cp globals.json.default globals.json

dev: globals.json
	@npm run dev

production: globals.json
	@npm run build

build-webext: globals.json 
	@./node_modules/.bin/web-ext build -s addon/

release: production build-webext

.PHONY: webext dev build
.DEFAULT_GOAL := dev
