import { Injectable } from '@nestjs/common';
import { MempoolInfoDto, RawMempoolEntryDto, MempoolEntryDto } from '../dtos/mempool.dto';
import { Node } from '@h3tag-blockchain/core';
import { Logger } from '@h3tag-blockchain/shared';

@Injectable()
export class MempoolService {
  constructor(private readonly node: Node) {}

  async getMempoolInfo(): Promise<MempoolInfoDto> {
    try {
      const mempoolInfo = await this.node.getMempool().getMempoolInfo();
      return {
        size: mempoolInfo.size,
        bytes: mempoolInfo.bytes,
        usage: mempoolInfo.usage,
        maxSize: mempoolInfo.maxSize,
        maxMemoryUsage: mempoolInfo.maxMemoryUsage,
        currentMemoryUsage: mempoolInfo.currentMemoryUsage,
        loadFactor: mempoolInfo.loadFactor,
        fees: mempoolInfo.fees,
        transactions: mempoolInfo.transactions,
        age: mempoolInfo.age,
        health: mempoolInfo.health,
      };
    } catch (error: unknown) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unknown error occurred in getMempoolInfo');
      Logger.error('Failed to get mempool info:', err);
      throw err;
    }
  }

  async getRawMempool(
    verbose = false,
  ): Promise<Record<string, RawMempoolEntryDto> | string[]> {
    try {
      return await this.node.getMempool().getRawMempool(verbose);
    } catch (error: unknown) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unknown error occurred in getRawMempool');
      Logger.error('Failed to get raw mempool:', err);
      throw err;
    }
  }

  async getMempoolEntry(txid: string): Promise<MempoolEntryDto> {
    try {
      const entry = await this.node.getMempool().getMempoolEntry(txid);
      if (!entry) {
        throw new Error(`Transaction ${txid} not found in mempool`);
      }
      return entry;
    } catch (error: unknown) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unknown error occurred in getMempoolEntry');
      Logger.error('Failed to get mempool entry:', err);
      throw err;
    }
  }
}
