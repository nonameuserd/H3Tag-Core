import semver from 'semver';
import { HybridCrypto } from '@h3tag-blockchain/crypto';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';

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
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Verification timeout')),
          this.VERIFICATION_TIMEOUT,
        ),
      );

      // Wrap verification in try-catch to handle timeout rejection properly
      return await Promise.race([
        this.verifyNodeWithTimeout(nodeInfo),
        timeoutPromise,
      ]);
    } catch (error) {
      Logger.error(`Node verification failed:`, error);
      return false;
    }
  }

  private static async verifyNodeWithTimeout(
    nodeInfo: NodeInfo,
  ): Promise<boolean> {
    if (!this.isValidNodeInfo(nodeInfo)) {
      throw new VerificationError('Invalid node info structure');
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
      const data = JSON.stringify({
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
    } catch (error) {
      throw new VerificationError(
        `Signature verification failed: ${error.message}`,
      );
    }
  }

  private static isValidNodeInfo(info: unknown): info is NodeInfo {
    const node = info as NodeInfo;
    return Boolean(
      node &&
        typeof node.version === 'string' &&
        typeof node.publicKey === 'string' &&
        typeof node.signature === 'string' &&
        typeof node.timestamp === 'number' &&
        typeof node.address === 'string' &&
        node.tagInfo &&
        typeof node.tagInfo.minedBlocks === 'number' &&
        typeof node.tagInfo.voteParticipation === 'number' &&
        typeof node.tagInfo.lastVoteHeight === 'number' &&
        typeof node.tagInfo.currency === 'string' &&
        node.tagInfo.currency === BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    );
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
        `Node timestamp is too far from current time`,
      );
    }
  }

  /**
   * Validates a node's network address format and security requirements
   * @param {string} address - The node address to validate
   * @throws {VerificationError} If the address is invalid
   */
  public static validateNodeAddress(address: string): void {
    try {
      // 1. Basic input validation
      if (!address || typeof address !== 'string') {
        throw new VerificationError('Missing or invalid node address');
      }

      // 2. Protocol validation - support both HTTP/HTTPS and P2P
      const isHttpAddress = address.match(/^https?:\/\//i);
      const isP2PAddress = address.match(/^p2p:\/\//i);

      if (!isHttpAddress && !isP2PAddress) {
        throw new VerificationError(
          `Node address must start with http://, https://, or p2p://`,
        );
      }

      // 3. Parse URL
      const url = new URL(address);

      // 4. Protocol-specific validation
      if (isHttpAddress) {
        // HTTP/HTTPS specific validations
        const urlRegex = new RegExp(
          '^' + // Start of string
            '(?:https?://)' + // Protocol (http or https)
            '(?:\\S+(?::\\S*)?@)?' + // Optional authentication
            '(?:' + // Hostname parts:
            '(?!(?:10|127)(?:\\.\\d{1,3}){3})' + // Exclude private ranges 10.x.x.x
            '(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})' + // Exclude private ranges 169.254.x.x, 192.168.x.x
            '(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})' + // Exclude private range 172.16.0.0 - 172.31.255.255
            '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' + // First octet
            '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' + // Second and third octets
            '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' + // Fourth octet
            '|' + // OR
            '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' + // Hostname
            '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' + // Domain
            '\\.(?:[a-z\\u00a1-\\uffff]{2,})' + // TLD
            ')' +
            '(?::\\d{2,5})?' + // Port number (optional)
            '(?:[/?#][^\\s]*)?$', // Path and query params (optional)
          'i', // Case-insensitive
        );

        if (!urlRegex.test(address)) {
          throw new VerificationError(`Invalid HTTP/HTTPS node address format`);
        }
      } else {
        // P2P specific validations
        const p2pRegex =
          /^p2p:\/\/([a-f0-9]{64}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{2,5})?$/i;
        if (!p2pRegex.test(address)) {
          throw new VerificationError('Invalid P2P node address format');
        }
      }

      // 5. Port validation
      const port = url.port;
      if (port) {
        const portNum = parseInt(port, 10);
        if (portNum < 1024 || portNum > 65535) {
          throw new VerificationError(
            'Invalid port number. Must be between 1024 and 65535',
          );
        }
      }

      // 6. Hostname length validation
      if (url.hostname.length > 253) {
        throw new VerificationError(
          'Hostname exceeds maximum length of 253 characters',
        );
      }

      // 7. Path security validation
      if (url.pathname.includes('..')) {
        throw new VerificationError(
          'Path contains invalid directory traversal patterns',
        );
      }

      Logger.debug('Node address validation successful', {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 'default',
        type: isHttpAddress ? 'HTTP(S)' : 'P2P',
      });
    } catch (error) {
      if (error instanceof VerificationError) {
        throw error;
      }
      Logger.error('Node address validation failed:', error);
      throw new VerificationError(`Invalid node address: ${error.message}`);
    }
  }
}
