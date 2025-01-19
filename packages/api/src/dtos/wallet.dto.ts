import { ApiProperty } from '@nestjs/swagger';

export class CreateWalletDto {
  @ApiProperty({
    description: 'Password to encrypt the wallet',
    example: 'mySecurePassword123',
  })
  password: string | undefined;

  @ApiProperty({
    description: 'Optional mnemonic phrase for wallet recovery',
    required: false,
    example: 'word1 word2 word3 ... word24',
  })
  mnemonic?: string | undefined;
}

export class WalletResponseDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef...',
  })
  address: string | undefined;

  @ApiProperty({
    description: 'Wallet public key',
    example: '0x04a1b2c3d4...',
  })
  publicKey: string | undefined;

  @ApiProperty({
    description: 'Current wallet balance',
    example: '1000000',
    required: false,
  })
  balance?: string | undefined;

  @ApiProperty({
    description: 'Whether the wallet is locked',
    example: false,
    required: false,
  })
  isLocked?: boolean | undefined;

  @ApiProperty({
    description: 'Wallet mnemonic phrase (only provided during creation)',
    example: 'word1 word2 word3 ...',
    required: false,
  })
  mnemonic?: string | undefined;
}

export interface SignTransactionDto {
  transaction: {
    fromAddress: string | undefined;
    toAddress: string | undefined;
    amount: number | undefined;
    publicKey: string | undefined;
    confirmations: number | undefined;
    fee?: number | undefined;
  };
  password: string;
}

export class SendToAddressDto {
  @ApiProperty({
    description: 'Recipient address',
    example: '0x1234...',
  })
  toAddress: string | undefined;

  @ApiProperty({
    description: 'Amount to send',
    example: '100',
  })
  amount: string | undefined;

  @ApiProperty({
    description: 'Wallet password',
    example: 'mySecurePassword',
  })
  password: string | undefined;
}

export class WalletBalanceDto {
  @ApiProperty({ description: 'Confirmed balance', example: '1000000' })
  confirmed: string | undefined;

  @ApiProperty({ description: 'Unconfirmed balance', example: '500000' })
  unconfirmed: string | undefined;
}

export class NewAddressResponseDto {
  @ApiProperty({ description: 'Newly generated address' })
  address: string | undefined;
}

export class ExportPrivateKeyDto {
  @ApiProperty({
    description: 'Wallet password for decryption',
    example: 'mySecurePassword123',
  })
  password: string | undefined;
}

export class ImportPrivateKeyDto {
  @ApiProperty({
    description: 'Encrypted private key to import',
    example: 'encrypted_key_string',
  })
  encryptedKey: string | undefined;

  @ApiProperty({
    description: 'Original wallet address',
    example: '0x1234...',
  })
  originalAddress: string | undefined;

  @ApiProperty({
    description: 'Password to decrypt the key',
    example: 'mySecurePassword123',
  })
  password: string | undefined;
}

export class UnspentOutputDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '7f9d9b2c3d4e5f6a1b2c3d4e5f6a7b8c',
  })
  txid: string | undefined;

  @ApiProperty({
    description: 'Output index in the transaction',
    example: 0,
  })
  vout: number | undefined;

  @ApiProperty({
    description: 'Address owning the UTXO',
    example: '0x1234...',
  })
  address: string | undefined;

  @ApiProperty({
    description: 'Amount in the smallest unit',
    example: '1000000',
  })
  amount: bigint | undefined;

  @ApiProperty({
    description: 'Number of confirmations',
    example: 6,
  })
  confirmations: number | undefined;

  @ApiProperty({
    description: 'Whether the output is spendable',
    example: true,
  })
  spendable: boolean | undefined;
}

export class TxOutDto {
  @ApiProperty({ description: 'Transaction ID' })
  txid: string | undefined;

  @ApiProperty({ description: 'Output index (vout)' })
  n: number | undefined;

  @ApiProperty({ description: 'Output value' })
  value: string | undefined;

  @ApiProperty({ description: 'Number of confirmations' })
  confirmations: number | undefined;

  @ApiProperty({ description: 'Output script type' })
  scriptType: string | undefined;

  @ApiProperty({ description: 'Address associated with output' })
  address: string | undefined;

  @ApiProperty({ description: 'Whether output is spendable' })
  spendable: boolean | undefined;
}
