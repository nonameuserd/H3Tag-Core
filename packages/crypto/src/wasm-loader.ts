export async function loadWasmModule(
  modulePath: string,
): Promise<WebAssembly.Module> {
  try {
    const response = await fetch(modulePath);
    const bytes = await response.arrayBuffer();
    return WebAssembly.compile(bytes);
  } catch (error) {
    throw new Error(`Failed to load WASM module: ${error}`);
  }
}
