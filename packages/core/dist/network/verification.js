"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeVerifier = exports.VerificationError = void 0;
const semver_1 = __importDefault(require("semver"));
const crypto_1 = require("@h3tag-blockchain/crypto");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
class VerificationError extends Error {
    constructor(message) {
        super(message);
        this.name = "VerificationError";
    }
}
exports.VerificationError = VerificationError;
class NodeVerifier {
    static async verifyNode(nodeInfo) {
        try {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Verification timeout")), this.VERIFICATION_TIMEOUT));
            // Wrap verification in try-catch to handle timeout rejection properly
            return await Promise.race([
                this.verifyNodeWithTimeout(nodeInfo),
                timeoutPromise,
            ]);
        }
        catch (error) {
            shared_1.Logger.error(`Node verification failed:`, error);
            return false;
        }
    }
    static async verifyNodeWithTimeout(nodeInfo) {
        if (!this.isValidNodeInfo(nodeInfo)) {
            throw new VerificationError("Invalid node info structure");
        }
        await Promise.all([
            this.validateVersion(nodeInfo.version),
            this.validateTimestamp(nodeInfo.timestamp),
            this.validateSignature(nodeInfo),
            this.validateNodeAddress(nodeInfo.address),
        ]);
        return this.verifyRequirements(nodeInfo);
    }
    static verifyRequirements(nodeInfo) {
        const minimumVotingPower = BigInt(this.MIN_VOTING_POWER);
        return (nodeInfo.tagInfo.minedBlocks >= this.MIN_POW_BLOCKS &&
            nodeInfo.tagInfo.voteParticipation >= this.MIN_PARTICIPATION_RATE &&
            nodeInfo.tagInfo.currency === constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL &&
            (nodeInfo.tagInfo.votingPower
                ? BigInt(nodeInfo.tagInfo.votingPower) >= minimumVotingPower
                : false));
    }
    static async validateSignature(nodeInfo) {
        try {
            const data = JSON.stringify({
                version: nodeInfo.version,
                timestamp: nodeInfo.timestamp,
                address: nodeInfo.address,
                tagInfo: nodeInfo.tagInfo,
            });
            const isValid = await crypto_1.HybridCrypto.verify(data, nodeInfo.signature, nodeInfo.publicKey);
            if (!isValid) {
                throw new VerificationError("Invalid node signature");
            }
        }
        catch (error) {
            throw new VerificationError(`Signature verification failed: ${error.message}`);
        }
    }
    static isValidNodeInfo(info) {
        const node = info;
        return Boolean(node &&
            typeof node.version === "string" &&
            typeof node.publicKey === "string" &&
            typeof node.signature === "string" &&
            typeof node.timestamp === "number" &&
            typeof node.address === "string" &&
            node.tagInfo &&
            typeof node.tagInfo.minedBlocks === "number" &&
            typeof node.tagInfo.voteParticipation === "number" &&
            typeof node.tagInfo.lastVoteHeight === "number" &&
            typeof node.tagInfo.currency === "string" &&
            node.tagInfo.currency === constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL);
    }
    static validateVersion(version) {
        if (!semver_1.default.valid(version) || !semver_1.default.gte(version, this.MIN_VERSION)) {
            throw new VerificationError(`Incompatible ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} version: ${version}. Minimum required: ${this.MIN_VERSION}`);
        }
    }
    static validateTimestamp(timestamp) {
        const now = Date.now();
        const drift = Math.abs(now - timestamp);
        const maxDrift = this.MAX_TIMESTAMP_DRIFT;
        if (drift > maxDrift || timestamp > now + maxDrift) {
            throw new VerificationError(`Node timestamp is too far from current time`);
        }
    }
    /**
     * Validates a node's network address format and security requirements
     * @param {string} address - The node address to validate
     * @throws {VerificationError} If the address is invalid
     */
    static validateNodeAddress(address) {
        try {
            // 1. Basic input validation
            if (!address || typeof address !== "string") {
                throw new VerificationError("Missing or invalid node address");
            }
            // 2. Protocol validation - support both HTTP/HTTPS and P2P
            const isHttpAddress = address.match(/^https?:\/\//i);
            const isP2PAddress = address.match(/^p2p:\/\//i);
            if (!isHttpAddress && !isP2PAddress) {
                throw new VerificationError(`Node address must start with http://, https://, or p2p://`);
            }
            // 3. Parse URL
            const url = new URL(address);
            // 4. Protocol-specific validation
            if (isHttpAddress) {
                // HTTP/HTTPS specific validations
                const urlRegex = new RegExp("^" + // Start of string
                    "(?:https?://)" + // Protocol (http or https)
                    "(?:\\S+(?::\\S*)?@)?" + // Optional authentication
                    "(?:" + // Hostname parts:
                    "(?!(?:10|127)(?:\\.\\d{1,3}){3})" + // Exclude private ranges 10.x.x.x
                    "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" + // Exclude private ranges 169.254.x.x, 192.168.x.x
                    "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" + // Exclude private range 172.16.0.0 - 172.31.255.255
                    "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" + // First octet
                    "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" + // Second and third octets
                    "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" + // Fourth octet
                    "|" + // OR
                    "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" + // Hostname
                    "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" + // Domain
                    "\\.(?:[a-z\\u00a1-\\uffff]{2,})" + // TLD
                    ")" +
                    "(?::\\d{2,5})?" + // Port number (optional)
                    "(?:[/?#][^\\s]*)?$", // Path and query params (optional)
                "i" // Case-insensitive
                );
                if (!urlRegex.test(address)) {
                    throw new VerificationError(`Invalid HTTP/HTTPS node address format`);
                }
            }
            else {
                // P2P specific validations
                const p2pRegex = /^p2p:\/\/([a-f0-9]{64}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{2,5})?$/i;
                if (!p2pRegex.test(address)) {
                    throw new VerificationError("Invalid P2P node address format");
                }
            }
            // 5. Port validation
            const port = url.port;
            if (port) {
                const portNum = parseInt(port, 10);
                if (portNum < 1024 || portNum > 65535) {
                    throw new VerificationError("Invalid port number. Must be between 1024 and 65535");
                }
            }
            // 6. Hostname length validation
            if (url.hostname.length > 253) {
                throw new VerificationError("Hostname exceeds maximum length of 253 characters");
            }
            // 7. Path security validation
            if (url.pathname.includes("..")) {
                throw new VerificationError("Path contains invalid directory traversal patterns");
            }
            shared_1.Logger.debug("Node address validation successful", {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || "default",
                type: isHttpAddress ? "HTTP(S)" : "P2P",
            });
        }
        catch (error) {
            if (error instanceof VerificationError) {
                throw error;
            }
            shared_1.Logger.error("Node address validation failed:", error);
            throw new VerificationError(`Invalid node address: ${error.message}`);
        }
    }
}
exports.NodeVerifier = NodeVerifier;
NodeVerifier.MIN_VERSION = "1.0.0";
NodeVerifier.MAX_TIMESTAMP_DRIFT = 300000; // 5 minutes
NodeVerifier.MIN_VOTING_POWER = "1000";
NodeVerifier.MIN_PARTICIPATION_RATE = 0.1; // 10%
NodeVerifier.MIN_POW_BLOCKS = 1;
NodeVerifier.VERIFICATION_TIMEOUT = 10000; // 10 seconds
//# sourceMappingURL=verification.js.map