export declare const CurrencyConstants: {
    readonly name: "H3TAG";
    readonly symbol: "TAG";
    readonly decimals: 18;
    readonly initialSupply: 21000000;
    readonly maxSupply: 696900000;
    readonly units: {
        readonly MACRO: 1n;
        readonly MICRO: 1000000n;
        readonly MILLI: 1000000000n;
        readonly TAG: 1000000000000n;
    };
};
export interface CurrencyConstants {
    name: string;
    symbol: string;
    decimals: number;
    initialSupply: bigint;
    maxSupply: bigint;
    units: {
        MACRO: bigint;
        MICRO: bigint;
        MILLI: bigint;
        TAG: bigint;
    };
}
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
