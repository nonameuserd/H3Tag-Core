{
  "targets": [
    {
      "target_name": "quantum",
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include\")"
      ],
      "cflags": ["-fstack-protector-strong", "-D_FORTIFY_SOURCE=2"],
      "conditions": [
        [ "OS=='mac'", {
          "xcode_settings": {
            "MACOSX_DEPLOYMENT_TARGET": "15.0",
            "OTHER_CFLAGS": [ "-arch arm64" ],
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
          },
          "include_dirs": [
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
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ]
        } ],
        [ "OS=='linux'", {
          "include_dirs": [
            "/usr/local/include",
            "/usr/include/openssl"
          ],
          "libraries": [
            "-L/usr/local/lib",
            "-loqs",
            "-lssl",
            "-lcrypto"
          ],
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ]
        } ],
        [ "OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "PreprocessorDefinitions": [
                "_WIN32",
                "NOMINMAX"
              ],
              "AdditionalIncludeDirectories": [
                "<!(node -p \"require('node-addon-api').include\")",
                "C:\\\\OpenSSL-Win64\\\\include"
              ]
            },
            "Link": {
              "AdditionalLibraryDirectories": [
                "C:\\\\OpenSSL-Win64\\\\lib"
              ],
              "AdditionalDependencies": [
                "oqs.lib",
                "libssl.lib",
                "libcrypto.lib"
              ]
            }
          },
          "defines": [ "WIN32" ]
        } ]
      ]
    }
  ]
}