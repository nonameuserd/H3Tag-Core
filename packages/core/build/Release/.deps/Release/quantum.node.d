cmd_Release/quantum.node := c++ -bundle -undefined dynamic_lookup -Wl,-search_paths_first -mmacosx-version-min=10.15 -arch arm64 -L./Release -stdlib=libc++  -o Release/quantum.node  -L/usr/local/lib -L/opt/homebrew/lib -loqs -lssl -lcrypto
