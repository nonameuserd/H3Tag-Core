{
  "targets": [
    {
      "target_name": "quantum",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "15.0",
        "OTHER_CFLAGS": [ "-arch arm64" ]
      },
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/usr/local/include",
        "/opt/homebrew/include",
        "/usr/include/openssl"
      ],
      "libraries": [
        "-L/usr/local/lib",
        "-L/opt/homebrew/lib",
        "-loqs",
        "-lssl",
        "-lcrypto"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-fstack-protector-strong", "-D_FORTIFY_SOURCE=2"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
      }
    }
  ]
}