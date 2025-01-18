import { ApiProperty } from "@nestjs/swagger";

export class CreateWalletDto {
  @ApiProperty({
    description: "Password to encrypt the wallet",
    example: "mySecurePassword123",
  })
  password: string;

  @ApiProperty({
    description: "Optional mnemonic phrase for wallet recovery",
    required: false,
    example: "word1 word2 word3 ... word24",
  })
  mnemonic?: string;
}

export class WalletResponseDto {
  @ApiProperty({
    description: "Wallet address",
    example: "0x1234567890abcdef...",
  })
  address: string;

  @ApiProperty({
    description: "Wallet public key",
    example: "0x04a1b2c3d4...",
  })
  publicKey: string;

  @ApiProperty({
    description: "Current wallet balance",
    example: "1000000",
    required: false,
  })
  balance?: string;

  @ApiProperty({
    description: "Whether the wallet is locked",
    example: false,
    required: false,
  })
  isLocked?: boolean;

  @ApiProperty({
    description: "Wallet mnemonic phrase (only provided during creation)",
    example: "word1 word2 word3 ...",
    required: false,
  })
  mnemonic?: string;
}

export interface SignTransactionDto {
  transaction: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    publicKey: string;
    confirmations: number;
    fee?: number;
  };
  password: string;
}

export class SendToAddressDto {
  @ApiProperty({
    description: "Recipient address",
    example: "0x1234...",
  })
  toAddress: string;

  @ApiProperty({
    description: "Amount to send",
    example: "100",
  })
  amount: string;

  @ApiProperty({
    description: "Wallet password",
    example: "mySecurePassword",
  })
  password: string;
}

export class WalletBalanceDto {
  @ApiProperty({ description: "Confirmed balance", example: "1000000" })
  confirmed: string;

  @ApiProperty({ description: "Unconfirmed balance", example: "500000" })
  unconfirmed: string;
}

export class NewAddressResponseDto {
  @ApiProperty({ description: "Newly generated address" })
  address: string;
}

export class ExportPrivateKeyDto {
  @ApiProperty({
    description: "Wallet password for decryption",
    example: "mySecurePassword123",
  })
  password: string;
}

export class ImportPrivateKeyDto {
  @ApiProperty({
    description: "Encrypted private key to import",
    example: "encrypted_key_string",
  })
  encryptedKey: string;

  @ApiProperty({
    description: "Original wallet address",
    example: "0x1234...",
  })
  originalAddress: string;

  @ApiProperty({
    description: "Password to decrypt the key",
    example: "mySecurePassword123",
  })
  password: string;
}

export class UnspentOutputDto {
  @ApiProperty({
    description: "Transaction ID",
    example: "7f9d9b2c3d4e5f6a1b2c3d4e5f6a7b8c",
  })
  txid: string;

  @ApiProperty({
    description: "Output index in the transaction",
    example: 0,
  })
  vout: number;

  @ApiProperty({
    description: "Address owning the UTXO",
    example: "0x1234...",
  })
  address: string;

  @ApiProperty({
    description: "Amount in the smallest unit",
    example: "1000000",
  })
  amount: string;

  @ApiProperty({
    description: "Number of confirmations",
    example: 6,
  })
  confirmations: number;

  @ApiProperty({
    description: "Whether the output is spendable",
    example: true,
  })
  spendable: boolean;
}

export class TxOutDto {
  @ApiProperty({ description: "Transaction ID" })
  txid: string;

  @ApiProperty({ description: "Output index (vout)" })
  n: number;

  @ApiProperty({ description: "Output value" })
  value: string;

  @ApiProperty({ description: "Number of confirmations" })
  confirmations: number;

  @ApiProperty({ description: "Output script type" })
  scriptType: string;

  @ApiProperty({ description: "Address associated with output" })
  address: string;

  @ApiProperty({ description: "Whether output is spendable" })
  spendable: boolean;
}
