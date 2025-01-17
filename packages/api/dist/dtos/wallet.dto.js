"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxOutDto = exports.UnspentOutputDto = exports.ImportPrivateKeyDto = exports.ExportPrivateKeyDto = exports.NewAddressResponseDto = exports.WalletBalanceDto = exports.SendToAddressDto = exports.WalletResponseDto = exports.CreateWalletDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreateWalletDto {
}
exports.CreateWalletDto = CreateWalletDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Password to encrypt the wallet",
        example: "mySecurePassword123",
    })
], CreateWalletDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Optional mnemonic phrase for wallet recovery",
        required: false,
        example: "word1 word2 word3 ... word24",
    })
], CreateWalletDto.prototype, "mnemonic", void 0);
class WalletResponseDto {
}
exports.WalletResponseDto = WalletResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Wallet address",
        example: "0x1234567890abcdef...",
    })
], WalletResponseDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Wallet public key",
        example: "0x04a1b2c3d4...",
    })
], WalletResponseDto.prototype, "publicKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Current wallet balance",
        example: "1000000",
        required: false,
    })
], WalletResponseDto.prototype, "balance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Whether the wallet is locked",
        example: false,
        required: false,
    })
], WalletResponseDto.prototype, "isLocked", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Wallet mnemonic phrase (only provided during creation)",
        example: "word1 word2 word3 ...",
        required: false,
    })
], WalletResponseDto.prototype, "mnemonic", void 0);
class SendToAddressDto {
}
exports.SendToAddressDto = SendToAddressDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Recipient address",
        example: "0x1234...",
    })
], SendToAddressDto.prototype, "toAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Amount to send",
        example: "100",
    })
], SendToAddressDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Wallet password",
        example: "mySecurePassword",
    })
], SendToAddressDto.prototype, "password", void 0);
class WalletBalanceDto {
}
exports.WalletBalanceDto = WalletBalanceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Confirmed balance", example: "1000000" })
], WalletBalanceDto.prototype, "confirmed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Unconfirmed balance", example: "500000" })
], WalletBalanceDto.prototype, "unconfirmed", void 0);
class NewAddressResponseDto {
}
exports.NewAddressResponseDto = NewAddressResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Newly generated address" })
], NewAddressResponseDto.prototype, "address", void 0);
class ExportPrivateKeyDto {
}
exports.ExportPrivateKeyDto = ExportPrivateKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Wallet password for decryption",
        example: "mySecurePassword123",
    })
], ExportPrivateKeyDto.prototype, "password", void 0);
class ImportPrivateKeyDto {
}
exports.ImportPrivateKeyDto = ImportPrivateKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Encrypted private key to import",
        example: "encrypted_key_string",
    })
], ImportPrivateKeyDto.prototype, "encryptedKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Original wallet address",
        example: "0x1234...",
    })
], ImportPrivateKeyDto.prototype, "originalAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Password to decrypt the key",
        example: "mySecurePassword123",
    })
], ImportPrivateKeyDto.prototype, "password", void 0);
class UnspentOutputDto {
}
exports.UnspentOutputDto = UnspentOutputDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction ID",
        example: "7f9d9b2c3d4e5f6a1b2c3d4e5f6a7b8c",
    })
], UnspentOutputDto.prototype, "txid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Output index in the transaction",
        example: 0,
    })
], UnspentOutputDto.prototype, "vout", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Address owning the UTXO",
        example: "0x1234...",
    })
], UnspentOutputDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Amount in the smallest unit",
        example: "1000000",
    })
], UnspentOutputDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of confirmations",
        example: 6,
    })
], UnspentOutputDto.prototype, "confirmations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Whether the output is spendable",
        example: true,
    })
], UnspentOutputDto.prototype, "spendable", void 0);
class TxOutDto {
}
exports.TxOutDto = TxOutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Transaction ID" })
], TxOutDto.prototype, "txid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output index (vout)" })
], TxOutDto.prototype, "n", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output value" })
], TxOutDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Number of confirmations" })
], TxOutDto.prototype, "confirmations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output script type" })
], TxOutDto.prototype, "scriptType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Address associated with output" })
], TxOutDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Whether output is spendable" })
], TxOutDto.prototype, "spendable", void 0);
//# sourceMappingURL=wallet.dto.js.map