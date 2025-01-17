"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryError = void 0;
class DiscoveryError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "DiscoveryError";
    }
}
exports.DiscoveryError = DiscoveryError;
//# sourceMappingURL=discovery-error.js.map