import { Dilithium } from './quantum/dilithium';
import { Kyber } from './quantum/kyber';

/**
 * QuantumHash helps calculate a deterministic hash that is quantum resistant 
 * by combining the outputs of Dilithium and Kyber hashing functions.
 */
export class QuantumHash {
  /**
   * Calculates a hybrid quantum-resistant hash for the provided data.
   * Uses both Dilithium and Kyber quantum-safe hash functions.
   *
   * @param data - The input data as a Buffer.
   * @returns A hex-encoded string of the combined hash.
   */
  public static async calculate(data: Buffer): Promise<string> {
    // Compute both hashes in parallel.
    const [dilithiumHash, kyberHashBase64] = await Promise.all([
      Dilithium.hash(data), // returns a Buffer
      Kyber.hash(data),     // returns a base64-encoded string
    ]);

    // Validate that Dilithium.hash returns a Buffer.
    if (!Buffer.isBuffer(dilithiumHash)) {
      throw new Error('Dilithium.hash did not return a Buffer.');
    }

    // Validate that Kyber.hash returns a string.
    if (typeof kyberHashBase64 !== 'string') {
      throw new Error('Kyber.hash did not return a base64 encoded string.');
    }

    let kyberHashBuffer: Buffer;
    try {
      // Convert the Kyber hash from base64 to a Buffer.
      kyberHashBuffer = Buffer.from(kyberHashBase64, 'base64');
    } catch (error: unknown) {
      throw new Error(`Failed to convert kyber hash from base64: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Optionally, check that the conversion resulted in a non-empty Buffer.
    if (kyberHashBuffer.length === 0) {
      throw new Error('Kyber.hash conversion resulted in an empty buffer.');
    }

    // Concatenate both hash outputs.
    const combinedBuffer = Buffer.concat([dilithiumHash, kyberHashBuffer]);

    // Return the combined hash as a hex string.
    return combinedBuffer.toString('hex');
  }
} 