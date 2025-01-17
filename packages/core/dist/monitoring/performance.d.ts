import { HybridDirectConsensus } from "../blockchain/consensus/hybrid-direct";
export declare class Performance {
    private static instance;
    private static metrics;
    static getInstance(): Performance;
    updateCacheMetrics(consensus: HybridDirectConsensus): void;
    static startTimer(label: string): string;
    static stopTimer(marker: string): number;
    static recordMetric(label: string, duration: number): void;
    getMetrics(): {
        [k: string]: any;
    };
}
