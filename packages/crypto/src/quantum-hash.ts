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

    // Convert the Kyber hash from base64 to a Buffer.
    const kyberHashBuffer = Buffer.from(kyberHashBase64, 'base64');
    
    // Concatenate both hash outputs.
    const combinedBuffer = Buffer.concat([dilithiumHash, kyberHashBuffer]);

    // Return the combined hash as a hex string.
    return combinedBuffer.toString('hex');
  }
} 