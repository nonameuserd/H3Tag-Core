export async function loadWasmModule(
  modulePath: string,
  importObject: WebAssembly.Imports = {}
): Promise<WebAssembly.Instance> {
  try {
    const response = await fetch(modulePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM module [${modulePath}]: ${response.statusText}`);
    }

    // Clone response for fallback since streaming might consume the body.
    const responseClone = response.clone();

    // Try using instantiateStreaming for efficiency.
    if (WebAssembly.instantiateStreaming) {
      try {
        const { instance } = await WebAssembly.instantiateStreaming(response, importObject);
        return instance;
      } catch (error) {
        // If instantiateStreaming fails (likely due to MIME type issues), fall back to ArrayBuffer instantiation.
        console.warn(
          `instantiateStreaming failed for ${modulePath}: ${
            error instanceof Error ? error.message : error
          }. Falling back to ArrayBuffer approach.`
        );
      }
    }

    // Fallback: manually read the bytes, compile, and instantiate.
    const bytes = await responseClone.arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, importObject);
    return instance;
  } catch (error) {
    throw new Error(
      `Failed to load WASM module [${modulePath}]: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}
