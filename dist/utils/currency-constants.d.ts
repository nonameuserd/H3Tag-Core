export declare const CurrencyConstants: {
    readonly name: "H3TAG";
    readonly symbol: "TAG";
    readonly decimals: 18;
    readonly initialSupply: 21000000;
    readonly maxSupply: 69690000;
    readonly units: {
        readonly WEI: bigint;
        readonly KWEI: bigint;
        readonly MWEI: bigint;
        readonly GWEI: bigint;
        readonly MICROTAG: bigint;
        readonly MILLITAG: bigint;
        readonly TAG: bigint;
    };
};
export declare const CurrencyUtils: {
    /**
     * Convert TAG to smallest unit (wei)
     */
    readonly toWei: (amount: number | string) => bigint;
    /**
     * Convert wei to TAG
     */
    readonly fromWei: (wei: bigint) => string;
    /**
     * Format amount with symbol
     */
    readonly format: (amount: bigint | number | string, options?: {
        decimals?: number;
        symbol?: boolean;
        compact?: boolean;
    }) => string;
    /**
     * Validate amount
     */
    readonly isValidAmount: (amount: bigint) => boolean;
};
export type CurrencyUnit = keyof typeof CurrencyConstants.units;
