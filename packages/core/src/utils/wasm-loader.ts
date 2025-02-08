export async function loadWasmModule(
  path: string,
): Promise<WebAssembly.Module> {
  let response = await fetch(path);

  // Validate that the response is successful.
  if (!response.ok) {
    throw new Error(
      `Failed to load WASM module from "${path}". HTTP Status: ${response.status} ${response.statusText}`,
    );
  }

  // Try to use instantiateStreaming if available.
  if ('instantiateStreaming' in WebAssembly) {
    try {
      const result = await WebAssembly.instantiateStreaming(response);
      return result.module;
    } catch (e) {
      console.warn(
        `instantiateStreaming failed for "${path}" due to: ${e}. Falling back to ArrayBuffer compilation.`,
      );
      // Clone the response to reuse in the fallback, as the original may be consumed
      response = response.clone();
    }
  }

  // Fallback: read the full module as an ArrayBuffer and compile.
  const bytes = await response.arrayBuffer();
  return WebAssembly.compile(bytes);
}
