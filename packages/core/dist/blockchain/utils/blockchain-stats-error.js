class BlockchainStatsError extends Error {
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'BlockchainStatsError';
    }
}
//# sourceMappingURL=blockchain-stats-error.js.map