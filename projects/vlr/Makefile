default:
	echo "Supply a real option"

.PHONY: mkdir-dist
mkdir-dist: 
	mkdir -p ./dist

.PHONY: rmrf-dist
rmrf-dist:
	rm -rf ./dist

.PHONY: build
build: rmrf-dist build-client build-server

.PHONY: build-client
build-client: mkdir-dist
	cd ./client && npm run build

.PHONY: build-server
build-server: mkdir-dist
	cd ./server && env GOOS=linux GOARCH=arm GOARM=5 go build -o ../dist/vlr-armhf && go build -o ../dist/vlr-amd64
	chmod +x ./dist/vlr-armhf
	chmod +x ./dist/vlr-amd64
