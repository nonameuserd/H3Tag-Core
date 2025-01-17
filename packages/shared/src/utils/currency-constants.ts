export const CurrencyConstants = {
  name: "H3TAG",
  symbol: "TAG",
  decimals: 18,
  initialSupply: 21000000,
  maxSupply: 69690000,
  units: {
    WEI: BigInt(1),
    KWEI: BigInt(1000),
    MWEI: BigInt(1000000),
    GWEI: BigInt(1000000000),
    MICROTAG: BigInt(1000000000000),
    MILLITAG: BigInt(1000000000000000),
    TAG: BigInt(1000000000000000000),
  },
} as const;

export const CurrencyUtils = {
  /**
   * Convert TAG to smallest unit (wei)
   */
  toWei(amount: number | string): bigint {
    const decimal = Number(amount) * Math.pow(10, CurrencyConstants.decimals);
    return BigInt(Math.floor(decimal));
  },

  /**
   * Convert wei to TAG
   */
  fromWei(wei: bigint): string {
    const divisor = BigInt(Math.pow(10, CurrencyConstants.decimals));
    const quotient = wei / divisor;
    const remainder = wei % divisor;
    const decimals = remainder
      .toString()
      .padStart(CurrencyConstants.decimals, "0");
    return `${quotient}.${decimals}`;
  },

  /**
   * Format amount with symbol
   */
  format(
    amount: bigint | number | string,
    options: {
      decimals?: number;
      symbol?: boolean;
      compact?: boolean;
    } = {}
  ): string {
    const {
      decimals = CurrencyConstants.decimals,
      symbol = true,
      compact = false,
    } = options;

    let value: string;
    if (typeof amount === "bigint") {
      value = this.fromWei(amount);
    } else {
      value = amount.toString();
    }

    // Handle compact notation
    if (compact) {
      const num = parseFloat(value);
      if (num >= 1e9) {
        return `${(num / 1e9).toFixed(1)}B${symbol ? " TAG" : ""}`;
      }
      if (num >= 1e6) {
        return `${(num / 1e6).toFixed(1)}M${symbol ? " TAG" : ""}`;
      }
      if (num >= 1e3) {
        return `${(num / 1e3).toFixed(1)}K${symbol ? " TAG" : ""}`;
      }
    }

    // Format with specified decimals
    const parts = value.split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1] || "0";

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formattedDecimals = decimalPart.slice(0, decimals);

    return `${formattedInteger}.${formattedDecimals}${symbol ? " TAG" : ""}`;
  },

  /**
   * Validate amount
   */
  isValidAmount(amount: bigint): boolean {
    return (
      amount >= 0n && amount <= CurrencyConstants.maxSupply * this.toWei(1)
    );
  },
} as const;

export type CurrencyUnit = keyof typeof CurrencyConstants.units;
