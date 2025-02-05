import semver from 'semver';
import { HybridCrypto } from '@h3tag-blockchain/crypto';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/PathReporter';

export interface NodeInfo {
  version: string;
  height: number;
  peers: number;
  isMiner: boolean;
  publicKey: string;
  signature: string;
  timestamp: number;
  address: string;
  tagInfo: {
    minedBlocks: number;
    voteParticipation: number;
    lastVoteHeight: number;
    currency: string;
    votingPower?: number;
  };
}

// Define io-ts codecs for robust schema validation

const NodeTagInfoCodec = t.intersection([
  t.type({
    minedBlocks: t.number,
    voteParticipation: t.number,
    lastVoteHeight: t.number,
    currency: t.literal(BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL),
  }),
  t.partial({
    votingPower: t.number,
  }),
]);

const NodeInfoCodec = t.type({
  version: t.string,
  height: t.number,
  peers: t.number,
  isMiner: t.boolean,
  publicKey: t.string,
  signature: t.string,
  timestamp: t.number,
  address: t.string,
  tagInfo: NodeTagInfoCodec,
});

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

export class NodeVerifier {
  private static readonly MIN_VERSION = '1.0.0';
  private static readonly MAX_TIMESTAMP_DRIFT = 300000; // 5 minutes
  private static readonly MIN_VOTING_POWER = '1000';
  private static readonly MIN_PARTICIPATION_RATE = 0.1; // 10%
  private static readonly MIN_POW_BLOCKS = 1;
  private static readonly VERIFICATION_TIMEOUT = 10000; // 10 seconds

  static async verifyNode(nodeInfo: NodeInfo): Promise<boolean> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Verification timeout')),
        this.VERIFICATION_TIMEOUT,
      );
    });

    try {
      const result = await Promise.race([
        this.verifyNodeWithTimeout(nodeInfo),
        timeoutPromise,
      ]);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Node verification failed:', errorMessage);
      return false;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private static async verifyNodeWithTimeout(
    nodeInfo: NodeInfo,
  ): Promise<boolean> {
    // Validate structure using io-ts codec
    const decoded = NodeInfoCodec.decode(nodeInfo);
    if (decoded._tag === 'Left') {
      throw new VerificationError(
        'Invalid node info structure: ' +
          PathReporter.report(decoded).join(', '),
      );
    }

    await Promise.all([
      this.validateVersion(nodeInfo.version),
      this.validateTimestamp(nodeInfo.timestamp),
      this.validateSignature(nodeInfo),
      this.validateNodeAddress(nodeInfo.address),
    ]);

    return this.verifyRequirements(nodeInfo);
  }

  private static verifyRequirements(nodeInfo: NodeInfo): boolean {
    const minimumVotingPower = BigInt(this.MIN_VOTING_POWER);
    return (
      nodeInfo.tagInfo.minedBlocks >= this.MIN_POW_BLOCKS &&
      nodeInfo.tagInfo.voteParticipation >= this.MIN_PARTICIPATION_RATE &&
      nodeInfo.tagInfo.currency === BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL &&
      (nodeInfo.tagInfo.votingPower
        ? BigInt(nodeInfo.tagInfo.votingPower) >= minimumVotingPower
        : false)
    );
  }

  private static async validateSignature(nodeInfo: NodeInfo): Promise<void> {
    try {
      const data = this.canonicalJSONStringify({
        version: nodeInfo.version,
        timestamp: nodeInfo.timestamp,
        address: nodeInfo.address,
        tagInfo: nodeInfo.tagInfo,
      });

      const isValid = await HybridCrypto.verify(
        data,
        nodeInfo.signature,
        nodeInfo.publicKey,
      );

      if (!isValid) {
        throw new VerificationError('Invalid node signature');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new VerificationError(
        `Signature verification failed: ${errorMessage}`,
      );
    }
  }

  private static validateVersion(version: string): void {
    if (!semver.valid(version) || !semver.gte(version, this.MIN_VERSION)) {
      throw new VerificationError(
        `Incompatible ${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} version: ${version}. Minimum required: ${this.MIN_VERSION}`,
      );
    }
  }

  private static validateTimestamp(timestamp: number): void {
    const now = Date.now();
    const drift = Math.abs(now - timestamp);
    const maxDrift = this.MAX_TIMESTAMP_DRIFT;

    if (drift > maxDrift || timestamp > now + maxDrift) {
      throw new VerificationError(
        `Node timestamp is too far from current time: ${drift}ms`,
      );
    }
  }

  /**
   * Validates a node's network address format and security requirements
   * @param {string} address - The node address to validate
   * @throws {VerificationError} If the address is invalid
   */
  public static validateNodeAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new VerificationError('Missing or invalid node address');
    }

    const isHttpAddress = /^https?:\/\//i.test(address);
    const isP2PAddress = /^p2p:\/\//i.test(address);

    if (!isHttpAddress && !isP2PAddress) {
      throw new VerificationError(
        'Node address must start with http://, https://, or p2p://',
      );
    }

    if (isHttpAddress) {
      let url: URL;
      try {
        url = new URL(address);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Node address validation failed:', errorMessage);
        throw new VerificationError(`Invalid node address: ${errorMessage}`);
      }

      // Example: Check that hostname is not a private IP.
      if (this.isPrivateHostname(url.hostname)) {
        throw new VerificationError('Private IP addresses are not allowed');
      }

      // Port validation
      if (url.port) {
        const portNum = parseInt(url.port, 10);
        if (portNum < 1024 || portNum > 65535) {
          throw new VerificationError(
            'Invalid port number. Must be between 1024 and 65535',
          );
        }
      }

      if (url.hostname.length > 253) {
        throw new VerificationError(
          'Hostname exceeds maximum length of 253 characters',
        );
      }

      if (url.pathname.includes('..')) {
        throw new VerificationError(
          'Path contains invalid directory traversal patterns',
        );
      }

      Logger.debug('Node address validation successful', {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 'default',
        type: 'HTTP(S)',
      });
    } else {
      // P2P specific validations
      const p2pRegex =
        /^p2p:\/\/([a-f0-9]{64}|\d{1,3}(?:\.\d{1,3}){3})(?::\d{2,5})?$/i;
      if (!p2pRegex.test(address)) {
        throw new VerificationError('Invalid P2P node address format');
      }

      // Manually extract host and port if needed
      const withoutProtocol = address.substring(6); // remove "p2p://"
      const [host, portStr] = withoutProtocol.split(':');
      if (portStr) {
        const portNum = parseInt(portStr, 10);
        if (portNum < 1024 || portNum > 65535) {
          throw new VerificationError(
            'Invalid port number in P2P address. Must be between 1024 and 65535',
          );
        }
      }

      Logger.debug('Node address validation successful for P2P address', {
        host,
        port: portStr || 'default',
      });
    }
  }

  private static isPrivateHostname(hostname: string): boolean {
    // Simple check for common private address ranges.
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    ];
    return privatePatterns.some((pattern) => pattern.test(hostname));
  }

  // Helper for canonical JSON stringification to guarantee property order
  private static canonicalJSONStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return (
        '[' + obj.map(this.canonicalJSONStringify.bind(this)).join(',') + ']'
      );
    }
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.canonicalJSONStringify((obj as Record<string, unknown>)[key])}`,
        )
        .join(',') +
      '}'
    );
  }
}
