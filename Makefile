IHGNG_VERSION=$(shell grep \"version\": addon/manifest.json | sed -rn  s/\\s*\"version\":\\s\"\(.+\)\",/\\1/p)


globals.json:
	cp globals.json.default globals.json

dev: globals.json
	@npm run dev

production: globals.json
	@npm run build

build-webext: globals.json 
	@./node_modules/.bin/web-ext build -s addon/

source-release: globals.json
	git archive master -o web-ext-artifacts/ihgng-$(IHGNG_VERSION)-src.zip

release: production build-webext source-release

.PHONY: webext dev build
.DEFAULT_GOAL := dev
