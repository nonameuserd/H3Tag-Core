import { Injectable } from '@nestjs/common';
import { MempoolInfoDto } from '../dtos/mempool.dto';
import { Node } from '@h3tag-blockchain/core';
import { Logger } from '@h3tag-blockchain/shared';
import { RawMempoolEntryDto } from '../dtos/mempool.dto';
import { MempoolEntryDto } from '../dtos/mempool.dto';

@Injectable()
export class MempoolService {
  constructor(private readonly node: Node) {}

  async getMempoolInfo(): Promise<MempoolInfoDto> {
    try {
      // Use the existing getMempoolInfo method from Mempool class
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
    } catch (error) {
      Logger.error('Failed to get mempool info:', error);
      throw error;
    }
  }

  async getRawMempool(
    verbose: boolean = false,
  ): Promise<Record<string, RawMempoolEntryDto> | string[]> {
    try {
      return await this.node.getMempool().getRawMempool(verbose);
    } catch (error) {
      Logger.error('Failed to get raw mempool:', error);
      throw error;
    }
  }

  async getMempoolEntry(txid: string): Promise<MempoolEntryDto> {
    try {
      const entry = await this.node.getMempool().getMempoolEntry(txid);
      if (!entry) {
        throw new Error(`Transaction ${txid} not found in mempool`);
      }
      return entry;
    } catch (error) {
      Logger.error('Failed to get mempool entry:', error);
      throw error;
    }
  }
}
