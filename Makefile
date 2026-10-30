DEST := $(HOME)/scripts

.PHONY: all build install cli app clean

all: build

install:
	bun install

cli:
	cargo build --release -p du-sk
	mkdir -p $(DEST)
	cp target/release/du-sk $(DEST)/

app:
	bun run tauri build

build: cli app

clean:
	cargo clean
	rm -rf dist
