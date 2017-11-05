# ihg-ng

## About

IHGng is a WebExtension compatible batch downloader for popular image hosting sites. 
Only supports FF55+ at the moment.
Click [here](FIXME) to install.   

## Build Setup

``` bash
# install dependencies
npm install

# copy build variables
cp globals.json.default globals.json

# edit build variables
vim globals.json

# build local dev version
make dev

# build release version
make production

# build and create addon .zip
make release
```

## Caveats

* Can only download to Firefox's download directory
* No recursive fetching