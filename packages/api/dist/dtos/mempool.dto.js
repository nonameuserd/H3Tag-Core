"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MempoolEntryDto = exports.RawMempoolEntryDto = exports.MempoolInfoDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MempoolInfoDto {
}
exports.MempoolInfoDto = MempoolInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "size", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "bytes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "usage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "maxSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "maxMemoryUsage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "currentMemoryUsage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "loadFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "fees", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "transactions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "age", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], MempoolInfoDto.prototype, "health", void 0);
class RawMempoolEntryDto {
}
exports.RawMempoolEntryDto = RawMempoolEntryDto;
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "txid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "fee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "vsize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "time", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "descendantcount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "descendantsize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "ancestorcount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], RawMempoolEntryDto.prototype, "ancestorsize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] })
], RawMempoolEntryDto.prototype, "depends", void 0);
class MempoolEntryDto {
}
exports.MempoolEntryDto = MempoolEntryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction ID",
        example: "1234abcd...",
    })
], MempoolEntryDto.prototype, "txid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction fee",
        example: 0.0001,
    })
], MempoolEntryDto.prototype, "fee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Virtual transaction size",
        example: 140,
    })
], MempoolEntryDto.prototype, "vsize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction weight",
        example: 560,
    })
], MempoolEntryDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Time transaction entered mempool",
        example: 1625097600,
    })
], MempoolEntryDto.prototype, "time", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Block height when transaction entered mempool",
        example: 680000,
    })
], MempoolEntryDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of descendant transactions",
        example: 2,
    })
], MempoolEntryDto.prototype, "descendantcount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Total size of descendant transactions",
        example: 280,
    })
], MempoolEntryDto.prototype, "descendantsize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of ancestor transactions",
        example: 1,
    })
], MempoolEntryDto.prototype, "ancestorcount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Total size of ancestor transactions",
        example: 140,
    })
], MempoolEntryDto.prototype, "ancestorsize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction IDs this transaction depends on",
        type: [String],
    })
], MempoolEntryDto.prototype, "depends", void 0);
